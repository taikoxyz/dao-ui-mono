import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import handler from "../pages/api/ipfs/[...cid]";
import {
  clearPinnedCidMemoForTests,
  collectBackgroundTasksForTests,
  createMemoryIpfsCacheStorage,
  FAILURE_CACHE,
  flushBackgroundTasksForTests,
  IMMUTABLE_CACHE,
  isPinnedCid,
  parseIpfsPath,
  setIpfsCacheStorageForTests,
  setPinnedCidCheckForTests,
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
    // Durable writes are gated on the CID being pinned on our Pinata account;
    // default to "pinned" so the write-through tests exercise the happy path.
    setPinnedCidCheckForTests(async () => true);
    // The write-through now runs in the background; collect the tasks so tests
    // can await them before asserting the durable cache landed.
    collectBackgroundTasksForTests();
    // Fail loudly if a test reaches the multi-block path without mocking it —
    // the real implementation would dial live trustless gateways.
    setVerifiedFetchForTests(async () => {
      throw new Error("verified fetch not mocked in this test");
    });
    resetRateLimitForTests();
  });

  afterEach(() => {
    setIpfsCacheStorageForTests(null);
    setPinnedCidCheckForTests(null);
    setVerifiedFetchForTests(null);
    clearPinnedCidMemoForTests();
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
    // Let the background write-through complete before the next read.
    await flushBackgroundTasksForTests();

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
    // Drain the background warm attempt (a no-op here, since the CID is unpinned).
    await flushBackgroundTasksForTests();
    const callsAfterFirst = gatewayCalls();

    // Not persisted: the second read must hit the gateways again.
    const second = mockRes();
    await call(mockReq({ cid }), second);
    expect(second.statusCode).toBe(200);
    expect(gatewayCalls()).toBeGreaterThan(callsAfterFirst);
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
    await flushBackgroundTasksForTests();

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

  test("rate-limits a single IP after the per-window budget is exhausted", async () => {
    // Keep fetch off the real network; the exact gateway outcome is irrelevant —
    // the rate limiter runs before any parse/cache/gateway work.
    mockGateway(new TextEncoder().encode("x"), "application/json");
    const headers = { "x-forwarded-for": "203.0.113.7" };

    let last = mockRes();
    // The limit is 60/min; drive well past it from one IP.
    for (let i = 0; i < 65; i++) {
      last = mockRes();
      await call(mockReq({ headers }), last);
    }
    expect(last.statusCode).toBe(429);
    expect(last.headers["retry-after"]).toBeDefined();

    // A different IP is unaffected.
    const other = mockRes();
    await call(mockReq({ headers: { "x-forwarded-for": "203.0.113.8" } }), other);
    expect(other.statusCode).not.toBe(429);
  });
});

describe("isPinnedCid (Pinata pin-list gate)", () => {
  const originalFetch = globalThis.fetch;
  const originalJwt = process.env.PINATA_JWT;

  beforeEach(() => {
    // Exercise the REAL implementation, not the test override.
    setPinnedCidCheckForTests(null);
    clearPinnedCidMemoForTests();
    process.env.PINATA_JWT = "test-jwt";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearPinnedCidMemoForTests();
    if (originalJwt === undefined) delete process.env.PINATA_JWT;
    else process.env.PINATA_JWT = originalJwt;
  });

  function mockPinList(rows: unknown[], status = 200) {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ rows }), {
        status,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
  }

  test("true only on an exact ipfs_pin_hash match", async () => {
    mockPinList([{ ipfs_pin_hash: VALID_CID }]);
    expect(await isPinnedCid(VALID_CID)).toBe(true);
  });

  test("false when only a substring matches (Pinata hashContains is a substring search)", async () => {
    mockPinList([{ ipfs_pin_hash: `${VALID_CID}extrasuffix` }]);
    expect(await isPinnedCid(VALID_CID)).toBe(false);
  });

  test("fails closed on a non-200 response", async () => {
    mockPinList([{ ipfs_pin_hash: VALID_CID }], 500);
    expect(await isPinnedCid(VALID_CID)).toBe(false);
  });

  test("fails closed when the request throws", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    expect(await isPinnedCid(VALID_CID)).toBe(false);
  });

  test("false when PINATA_JWT is not configured", async () => {
    delete process.env.PINATA_JWT;
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    expect(await isPinnedCid(VALID_CID)).toBe(false);
    expect(fetched).toBe(false);
  });

  test("memoizes within the TTL so repeat lookups make one Pinata call", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ rows: [{ ipfs_pin_hash: VALID_CID }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    expect(await isPinnedCid(VALID_CID)).toBe(true);
    expect(await isPinnedCid(VALID_CID)).toBe(true);
    expect(calls).toBe(1);
  });
});
