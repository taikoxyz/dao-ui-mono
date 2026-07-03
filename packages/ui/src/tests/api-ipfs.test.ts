import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import handler from "../pages/api/ipfs/[...cid]";
import {
  createMemoryIpfsCacheStorage,
  IMMUTABLE_CACHE,
  parseIpfsPath,
  setIpfsCacheStorageForTests,
  setPinnedCidCheckForTests,
  UNVERIFIED_CACHE,
  warmToCache,
} from "../server/ipfs/mirror";

type MockRes = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  setHeader: (k: string, v: string) => void;
  status: (code: number) => MockRes;
  json: (payload: unknown) => MockRes;
  send: (payload: unknown) => MockRes;
};

function mockRes(): MockRes {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(k: string, v: string) {
      this.headers[k.toLowerCase()] = v;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

type ReqInit = { method?: string; cid?: string | string[] };
function mockReq(init: ReqInit = {}) {
  return { method: init.method ?? "GET", query: { cid: init.cid ?? VALID_CID } };
}

type Handler = typeof handler;
const call = (req: ReturnType<typeof mockReq>, res: MockRes) =>
  handler(req as unknown as Parameters<Handler>[0], res as unknown as Parameters<Handler>[1]);

// A well-formed raw CID with no content seeded (used for 4xx/5xx paths).
const VALID_CID = "bafkreid7qoywk77r7rj3slobqfekdvs57qwuwh5d2z3sqsw52iabe3mqne";

async function cidForBytes(bytes: Uint8Array) {
  const hash = await sha256.digest(bytes);
  return CID.create(1, raw.code, hash).toString();
}

// Seed the durable cache directly (no gateway fetch), as the pin/seed paths do.
async function seedCache(value: string | Uint8Array, contentType = "application/json") {
  const body = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const cid = await cidForBytes(body);
  const parsed = parseIpfsPath(cid);
  if (!parsed) throw new Error("test CID did not parse");
  await warmToCache(parsed, Buffer.from(body), contentType);
  return { cid, body: Buffer.from(body) };
}

// Pretend the public gateways return `body` for any request.
function mockGateway(body: Uint8Array, contentType: string) {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(body, { status: 200, headers: { "content-type": contentType } });
  }) as unknown as typeof fetch;
  return () => calls;
}

describe("/api/ipfs/[...cid]", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setIpfsCacheStorageForTests(createMemoryIpfsCacheStorage());
    // Durable writes are gated on the CID being pinned on our Pinata account;
    // default to "pinned" so the write-through tests exercise the happy path.
    setPinnedCidCheckForTests(async () => true);
  });

  afterEach(() => {
    setIpfsCacheStorageForTests(null);
    setPinnedCidCheckForTests(null);
    globalThis.fetch = originalFetch;
  });

  test("serves a cached CID from Blob without touching a gateway", async () => {
    const payload = JSON.stringify({ title: "Enable Raiko2 on mainnet" });
    const { cid } = await seedCache(payload);
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("nope", { status: 200 });
    }) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq({ cid }), res);

    expect(fetched).toBe(false);
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe(IMMUTABLE_CACHE);
    expect(res.headers["content-type"]).toBe("application/json");
    expect(res.headers["content-security-policy"]).toContain("sandbox");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect((res.body as Buffer).toString("utf8")).toBe(payload);
  });

  test("on a cold miss, races gateways, serves, and writes through so the next read is cached", async () => {
    const payload = JSON.stringify({ hello: "world" });
    const body = new TextEncoder().encode(payload);
    const cid = await cidForBytes(body);
    const gatewayCalls = mockGateway(body, "application/json");

    const first = mockRes();
    await call(mockReq({ cid }), first);
    expect(first.statusCode).toBe(200);
    expect(first.headers["cache-control"]).toBe(IMMUTABLE_CACHE);
    expect((first.body as Buffer).toString("utf8")).toBe(payload);
    expect(gatewayCalls()).toBeGreaterThan(0);

    // Second read is served from the durable cache — no further gateway calls.
    const callsAfterFirst = gatewayCalls();
    const second = mockRes();
    await call(mockReq({ cid }), second);
    expect(second.statusCode).toBe(200);
    expect(gatewayCalls()).toBe(callsAfterFirst);
  });

  test("serves an unpinned CID but never writes it to the durable cache", async () => {
    setPinnedCidCheckForTests(async () => false);
    const body = new TextEncoder().encode(JSON.stringify({ attacker: "pinned this themselves" }));
    const cid = await cidForBytes(body);
    const gatewayCalls = mockGateway(body, "application/json");

    const first = mockRes();
    await call(mockReq({ cid }), first);
    expect(first.statusCode).toBe(200);
    const callsAfterFirst = gatewayCalls();

    // Not persisted: the second read must hit the gateways again.
    const second = mockRes();
    await call(mockReq({ cid }), second);
    expect(second.statusCode).toBe(200);
    expect(gatewayCalls()).toBeGreaterThan(callsAfterFirst);
  });

  test("serves an unverifiable (dag-pb) CID with a short TTL, not immutable", async () => {
    // CIDv0 → dag-pb, not raw sha2-256, so the bytes cannot be verified.
    const dagPbCid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    const body = new TextEncoder().encode("legacy proposal metadata");
    mockGateway(body, "application/json");

    const res = mockRes();
    await call(mockReq({ cid: dagPbCid }), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe(UNVERIFIED_CACHE);
  });

  test("serves a CID subpath with a short TTL, not immutable", async () => {
    const body = new TextEncoder().encode("file in a directory");
    mockGateway(body, "text/plain");

    const res = mockRes();
    await call(mockReq({ cid: [VALID_CID, "metadata.json"] }), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe(UNVERIFIED_CACHE);
  });

  test("falls back to the gateways when the durable cache errors (e.g. Blob outage)", async () => {
    setIpfsCacheStorageForTests({
      async get() {
        throw new Error("BLOB_READ_WRITE_TOKEN missing");
      },
      async put() {
        throw new Error("BLOB_READ_WRITE_TOKEN missing");
      },
    });
    const payload = JSON.stringify({ still: "served" });
    const body = new TextEncoder().encode(payload);
    const cid = await cidForBytes(body);
    mockGateway(body, "application/json");

    const res = mockRes();
    await call(mockReq({ cid }), res);

    expect(res.statusCode).toBe(200);
    expect((res.body as Buffer).toString("utf8")).toBe(payload);
  });

  test("collapses scriptable content to an inert attachment", async () => {
    const html = "<script>alert(document.cookie)</script>";
    const body = new TextEncoder().encode(html);
    const cid = await cidForBytes(body);
    mockGateway(body, "text/html");

    const res = mockRes();
    await call(mockReq({ cid }), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.headers["content-disposition"]).toBe('attachment; filename="ipfs-content.bin"');
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  test("supports HEAD without returning a body", async () => {
    const { cid } = await seedCache("verified metadata", "text/plain");
    const res = mockRes();
    await call(mockReq({ method: "HEAD", cid }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeUndefined();
  });

  test("returns 502 (not cached) when every gateway fails", async () => {
    globalThis.fetch = (async () => {
      throw new Error("gateway down");
    }) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq(), res);

    expect(res.statusCode).toBe(502);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect((res.body as { error: { reason: string } }).error.reason).toBe("IPFS_UNAVAILABLE");
  });

  test("rejects a non-CID path without contacting any gateway", async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("should not happen", { status: 200 });
    }) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq({ cid: "http://169.254.169.254/latest/meta-data" }), res);

    expect(fetched).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  test("rejects path traversal in the CID subpath", async () => {
    const res = mockRes();
    await call(mockReq({ cid: `${VALID_CID}/../secret` }), res);
    expect(res.statusCode).toBe(400);
  });

  test("rejects URL-encoded path traversal in the CID subpath", async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("should not happen", { status: 200 });
    }) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq({ cid: [VALID_CID, "%2e%2e", "secret"] }), res);

    expect(fetched).toBe(false);
    expect(res.statusCode).toBe(400);
  });

  test("rejects non-GET methods", async () => {
    const res = mockRes();
    await call(mockReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
  });
});
