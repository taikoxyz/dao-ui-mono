import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import handler from "../pages/api/ipfs/[...cid]";
import {
  createMemoryIpfsCacheStorage,
  FAILURE_CACHE,
  IMMUTABLE_CACHE,
  parseIpfsPath,
  setIpfsCacheStorageForTests,
  setVerifiedFetchForTests,
  warmToCache,
} from "../server/ipfs/mirror";
import { resetRateLimitForTests } from "../server/rate-limit";

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

type ReqInit = { method?: string; cid?: string | string[]; headers?: Record<string, string> };
function mockReq(init: ReqInit = {}) {
  return { method: init.method ?? "GET", headers: init.headers ?? {}, query: { cid: init.cid ?? VALID_CID } };
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
    // Fail loudly if a test reaches the multi-block path without mocking it —
    // the real implementation would dial live trustless gateways.
    setVerifiedFetchForTests(async () => {
      throw new Error("verified fetch not mocked in this test");
    });
    resetRateLimitForTests();
  });

  afterEach(() => {
    setIpfsCacheStorageForTests(null);
    setVerifiedFetchForTests(null);
    resetRateLimitForTests();
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

  test("on a cold miss, races the gateways and serves the verified bytes", async () => {
    const payload = JSON.stringify({ hello: "world" });
    const body = new TextEncoder().encode(payload);
    const cid = await cidForBytes(body);
    const gatewayCalls = mockGateway(body, "application/json");

    const res = mockRes();
    await call(mockReq({ cid }), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe(IMMUTABLE_CACHE);
    expect((res.body as Buffer).toString("utf8")).toBe(payload);
    expect(gatewayCalls()).toBeGreaterThan(0);
  });

  test("a GET never writes to the durable cache, so anonymous reads cannot mirror bytes into Blob", async () => {
    // The read route is read-only. It once lazily warmed Blob on a cold miss,
    // gated on the CID being on our Pinata pin list — but /api/pin takes
    // unauthenticated pins, so an attacker could pin their own content and then
    // GET it to have us persist it. Writes now happen only on the pin path.
    const body = new TextEncoder().encode(JSON.stringify({ attacker: "pinned this themselves" }));
    const cid = await cidForBytes(body);
    const gatewayCalls = mockGateway(body, "application/json");

    let writes = 0;
    const memory = createMemoryIpfsCacheStorage();
    setIpfsCacheStorageForTests({
      get: (key) => memory.get(key),
      put: (key, value, contentType) => {
        writes++;
        return memory.put(key, value, contentType);
      },
    });

    const first = mockRes();
    await call(mockReq({ cid }), first);
    expect(first.statusCode).toBe(200);
    expect(writes).toBe(0);

    // Nothing was persisted, so a second read must hit the gateways again.
    const callsAfterFirst = gatewayCalls();
    const second = mockRes();
    await call(mockReq({ cid }), second);
    expect(second.statusCode).toBe(200);
    expect(gatewayCalls()).toBeGreaterThan(callsAfterFirst);
    expect(writes).toBe(0);
  });

  test("serves a multi-block (dag-pb) CID through verified-fetch with the immutable header", async () => {
    // CIDv0 → dag-pb, not a single raw block, so it must go through the
    // block-by-block verified path, never the flat gateway race.
    const dagPbCid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    const payload = JSON.stringify({ title: "a proposal too big for one block" });
    let verifiedUrl: string | undefined;
    setVerifiedFetchForTests(async (url) => {
      verifiedUrl = url;
      return new Response(payload, { status: 200 });
    });
    let gatewayFetched = false;
    globalThis.fetch = (async () => {
      gatewayFetched = true;
      return new Response("must not be used", { status: 200 });
    }) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq({ cid: dagPbCid }), res);

    expect(res.statusCode).toBe(200);
    expect(verifiedUrl).toBe(`ipfs://${dagPbCid}`);
    expect(gatewayFetched).toBe(false);
    expect(res.headers["cache-control"]).toBe(IMMUTABLE_CACHE);
    // Reassembled bytes carry no trustworthy upstream type; JSON is sniffed.
    expect(res.headers["content-type"]).toBe("application/json");
    expect((res.body as Buffer).toString("utf8")).toBe(payload);
  });

  test("serves a CID subpath through verified-fetch", async () => {
    setVerifiedFetchForTests(
      async () => new Response("file in a directory", { status: 200, headers: { "content-type": "text/plain" } })
    );

    const res = mockRes();
    await call(mockReq({ cid: [VALID_CID, "metadata.json"] }), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe(IMMUTABLE_CACHE);
    expect(res.headers["content-type"]).toBe("text/plain");
  });

  test("fails closed (502) when a multi-block CID cannot be fetched verified", async () => {
    // The default beforeEach mock throws — and there must be NO downgrade to
    // an unverified flat gateway fetch, so the gateways are never contacted.
    const dagPbCid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    let gatewayFetched = false;
    globalThis.fetch = (async () => {
      gatewayFetched = true;
      return new Response("unverified bytes", { status: 200 });
    }) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq({ cid: dagPbCid }), res);

    expect(res.statusCode).toBe(502);
    expect(gatewayFetched).toBe(false);
    expect(res.headers["cache-control"]).toBe(FAILURE_CACHE);
  });

  test("does not write multi-block content to the durable cache", async () => {
    const dagPbCid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    let verifiedCalls = 0;
    setVerifiedFetchForTests(async () => {
      verifiedCalls++;
      return new Response("big verified content", { status: 200, headers: { "content-type": "text/plain" } });
    });

    await call(mockReq({ cid: dagPbCid }), mockRes());

    // A second read must fetch again: nothing was persisted to Blob (file
    // bytes of a dag-pb object cannot be re-verified on read).
    await call(mockReq({ cid: dagPbCid }), mockRes());
    expect(verifiedCalls).toBe(2);
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
    expect(res.headers["cache-control"]).toBe(FAILURE_CACHE);
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

  test("does not serve cached bytes that fail re-verification against the CID (tampered Blob)", async () => {
    const realPayload = JSON.stringify({ real: "metadata" });
    const realBody = new TextEncoder().encode(realPayload);
    const cid = await cidForBytes(realBody);

    // The durable store hands back bytes that do NOT hash to the requested CID
    // (a tampered/poisoned Blob object). getCachedIpfs must reject them.
    const tampered = new TextEncoder().encode(JSON.stringify({ tampered: "evil" }));
    setIpfsCacheStorageForTests({
      async get() {
        return { body: Buffer.from(tampered), contentType: "application/json" };
      },
      async put() {},
    });
    // The gateway serves the genuine bytes, so the handler can fall through.
    mockGateway(realBody, "application/json");

    const res = mockRes();
    await call(mockReq({ cid }), res);

    expect(res.statusCode).toBe(200);
    // Served the verified gateway bytes, never the tampered cache entry.
    expect((res.body as Buffer).toString("utf8")).toBe(realPayload);
    expect(res.headers["cache-control"]).toBe(IMMUTABLE_CACHE);
  });

  test("rate-limits the Vercel client IP even when x-forwarded-for is spoofed", async () => {
    // Keep fetch off the real network; the exact gateway outcome is irrelevant —
    // the rate limiter runs before any parse/cache/gateway work.
    mockGateway(new TextEncoder().encode("x"), "application/json");

    let last = mockRes();
    // The limit is 60/min. Keep Vercel's platform-set IP stable while rotating
    // the client-controlled XFF value; all requests must share one bucket.
    for (let i = 0; i < 65; i++) {
      last = mockRes();
      await call(
        mockReq({
          headers: {
            "x-vercel-forwarded-for": "203.0.113.7",
            "x-forwarded-for": `198.51.100.${i}`,
          },
        }),
        last
      );
    }
    expect(last.statusCode).toBe(429);
    expect(last.headers["retry-after"]).toBeDefined();

    // A different IP is unaffected.
    const other = mockRes();
    await call(mockReq({ headers: { "x-vercel-forwarded-for": "203.0.113.8" } }), other);
    expect(other.statusCode).not.toBe(429);
  });
});
