import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { importer } from "ipfs-unixfs-importer";
import { sha256 } from "multiformats/hashes/sha2";
import handler, { config } from "../pages/api/pin";
import {
  createMemoryIpfsCacheStorage,
  getCachedIpfs,
  parseIpfsPath,
  setIpfsCacheStorageForTests,
} from "../server/ipfs/mirror";
import { rateLimit, resetRateLimitForTests } from "../server/rate-limit";

type MockRes = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  setHeader: (name: string, value: string) => MockRes;
  status: (code: number) => MockRes;
  json: (payload: unknown) => MockRes;
};

function mockRes(): MockRes {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

const HOST = "dao.test";

type ReqInit = { method?: string; headers?: Record<string, string>; body?: unknown };

// Same-origin browser request by default; tests override what they exercise.
function mockReq(init: ReqInit = {}) {
  return {
    method: init.method ?? "POST",
    headers: { host: HOST, origin: `https://${HOST}`, ...(init.headers ?? {}) },
    body: init.body !== undefined ? init.body : { body: "{}" },
  };
}

type Handler = typeof handler;
const call = (req: unknown, res: MockRes) =>
  handler(req as Parameters<Handler>[0], res as unknown as Parameters<Handler>[1]);

async function cidForBody(body: string) {
  const bytes = Buffer.from(body, "utf8");
  const hash = await sha256.digest(bytes);
  return CID.create(1, raw.code, hash).toString();
}

async function unixfsCidForBody(body: string) {
  let cid: { toString(): string } | undefined;
  const sink: Parameters<typeof importer>[1] = {
    async put(key) {
      return key;
    },
  };
  for await (const entry of importer([{ content: Buffer.from(body) }], sink, { cidVersion: 1, rawLeaves: false })) {
    cid = entry.cid;
  }
  if (!cid) throw new Error("UnixFS importer returned no CID");
  return cid.toString();
}

describe("/api/pin", () => {
  const originalFetch = globalThis.fetch;
  const originalJwt = process.env.PINATA_JWT;

  beforeEach(() => {
    setIpfsCacheStorageForTests(createMemoryIpfsCacheStorage());
    resetRateLimitForTests();
  });

  afterEach(() => {
    setIpfsCacheStorageForTests(null);
    globalThis.fetch = originalFetch;
    if (originalJwt === undefined) delete process.env.PINATA_JWT;
    else process.env.PINATA_JWT = originalJwt;
  });

  test("allows the JSON-escaped worst case at the metadata size limit", () => {
    const maxMetadataBytes = 2 * 1024 * 1024;
    const serializedBytes = Buffer.byteLength(JSON.stringify({ body: "\0".repeat(maxMetadataBytes) }), "utf8");
    const parserLimit = config.api.bodyParser.sizeLimit;
    const parserLimitBytes = Number.parseInt(parserLimit, 10) * 1024 * 1024;

    expect(parserLimitBytes).toBeGreaterThanOrEqual(serializedBytes);
  });

  test("attaches the server-only JWT, relays the CID, and pre-warms the durable cache", async () => {
    process.env.PINATA_JWT = "server-secret-jwt";
    const metadata = JSON.stringify({ title: "x" });
    const cid = await cidForBody(metadata);
    let pinataUrl = "";
    let pinataAuth = "";
    let sentBody: unknown;
    globalThis.fetch = (async (input: unknown, init: RequestInit) => {
      pinataUrl = typeof input === "string" ? input : ((input as Request)?.url ?? "");
      pinataAuth = new Headers(init?.headers).get("authorization") ?? "";
      sentBody = init?.body;
      return new Response(JSON.stringify({ IpfsHash: cid }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq({ body: { body: metadata } }), res);

    expect(pinataUrl).toBe("https://api.pinata.cloud/pinning/pinFileToIPFS");
    expect(pinataAuth).toBe("Bearer server-secret-jwt");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ IpfsHash: cid });
    // The just-pinned bytes are verified and written to the durable cache.
    const parsed = parseIpfsPath(cid);
    if (!parsed) throw new Error("test CID did not parse");
    const cached = await getCachedIpfs(parsed);
    expect(cached?.body.toString("utf8")).toBe(metadata);
    // Multipart contract: a file part is sent (no reliance on global `File`)
    expect(sentBody).toBeInstanceOf(FormData);
    const form = sentBody as FormData;
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect(String(form.get("pinataMetadata"))).toContain("taiko.json");
  });

  test("pre-warms the durable cache for Pinata's dag-pb UnixFS CID", async () => {
    process.env.PINATA_JWT = "server-secret-jwt";
    const metadata = JSON.stringify({ title: "unixfs" });
    const cid = await unixfsCidForBody(metadata);
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ IpfsHash: cid }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq({ body: { body: metadata } }), res);

    expect(res.statusCode).toBe(200);
    const parsed = parseIpfsPath(cid);
    if (!parsed) throw new Error("test CID did not parse");
    expect((await getCachedIpfs(parsed))?.body.toString("utf8")).toBe(metadata);
  });

  test("relays Pinata error status and body unchanged", async () => {
    process.env.PINATA_JWT = "server-secret-jwt";
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ error: { reason: "FORBIDDEN", details: "Account blocked due to plan usage limit" } }),
        {
          status: 403,
          headers: { "content-type": "application/json" },
        }
      )) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq(), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: { reason: "FORBIDDEN", details: "Account blocked due to plan usage limit" } });
  });

  test("still succeeds (best-effort warm) when the returned CID does not match the submitted bytes", async () => {
    process.env.PINATA_JWT = "server-secret-jwt";
    const mismatchedCid = await cidForBody("different bytes");
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ IpfsHash: mismatchedCid }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq({ body: { body: JSON.stringify({ title: "x" }) } }), res);

    // Pin succeeds — a warm failure must never block proposal creation...
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ IpfsHash: mismatchedCid });
    // ...and the mismatched bytes are not written to the cache.
    const parsed = parseIpfsPath(mismatchedCid);
    if (!parsed) throw new Error("test CID did not parse");
    expect(await getCachedIpfs(parsed)).toBeNull();
  });

  test("rejects a successful Pinata response without a valid IpfsHash", async () => {
    process.env.PINATA_JWT = "server-secret-jwt";
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ IpfsHash: "not-a-cid" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq(), res);

    expect(res.statusCode).toBe(502);
    expect((res.body as { error: { reason: string } }).error.reason).toBe("BAD_GATEWAY");
  });

  test("rejects non-POST requests", async () => {
    const res = mockRes();
    await call(mockReq({ method: "GET" }), res);
    expect(res.statusCode).toBe(405);
  });

  test("rejects cross-origin requests", async () => {
    process.env.PINATA_JWT = "server-secret-jwt";
    const res = mockRes();
    await call(mockReq({ headers: { origin: "https://evil.example" } }), res);
    expect(res.statusCode).toBe(403);
    expect((res.body as { error: { reason: string } }).error.reason).toBe("FORBIDDEN");
  });

  test("rate-limits pin attempts by client IP", async () => {
    process.env.PINATA_JWT = "server-secret-jwt";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = mockRes();
      await call(mockReq({ body: {} }), res);
      expect(res.statusCode).toBe(400);
    }

    const res = mockRes();
    await call(mockReq({ body: {} }), res);

    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBe("60");
    expect((res.body as { error: { reason: string } }).error.reason).toBe("RATE_LIMITED");
  });

  test("keeps the in-memory limiter bounded when all tracked windows are live", () => {
    const now = 1_000;
    rateLimit("oldest", 1, 60_000, now);
    for (let index = 1; index < 10_000; index += 1) rateLimit(`key-${index}`, 1, 60_000, now);

    rateLimit("new-key", 1, 60_000, now);

    // The oldest live key was evicted to make room, so it starts a fresh
    // window instead of retaining an eleventh-thousandth map entry.
    expect(rateLimit("oldest", 1, 60_000, now).allowed).toBe(true);
  });

  test("rejects requests with no Origin or Referer", async () => {
    process.env.PINATA_JWT = "server-secret-jwt";
    const res = mockRes();
    await call({ method: "POST", headers: { host: HOST }, body: { body: "{}" } }, res);
    expect(res.statusCode).toBe(403);
  });

  test("fails clearly when PINATA_JWT is not configured", async () => {
    delete process.env.PINATA_JWT;
    const res = mockRes();
    await call(mockReq(), res);
    expect(res.statusCode).toBe(500);
  });

  test("rejects a malformed request body", async () => {
    process.env.PINATA_JWT = "server-secret-jwt";
    const res = mockRes();
    await call(mockReq({ body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test("rejects metadata larger than the size cap", async () => {
    process.env.PINATA_JWT = "server-secret-jwt";
    const huge = "a".repeat(2 * 1024 * 1024 + 1);
    const res = mockRes();
    await call(mockReq({ body: { body: huge } }), res);
    expect(res.statusCode).toBe(413);
    expect((res.body as { error: { reason: string } }).error.reason).toBe("PAYLOAD_TOO_LARGE");
  });

  test("returns a structured error when Pinata is unreachable", async () => {
    process.env.PINATA_JWT = "server-secret-jwt";
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq(), res);

    expect(res.statusCode).toBe(502);
    expect((res.body as { error: { reason: string } }).error.reason).toBe("UPSTREAM_ERROR");
  });

  test("returns a structured error when Pinata responds with non-JSON", async () => {
    process.env.PINATA_JWT = "server-secret-jwt";
    globalThis.fetch = (async () =>
      new Response("<html>502 Bad Gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      })) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq(), res);

    expect(res.statusCode).toBe(502);
    expect((res.body as { error: { reason: string } }).error.reason).toBe("BAD_GATEWAY");
  });
});
