import { afterEach, describe, expect, test } from "bun:test";
import handler from "../pages/api/ipfs/[cid]";

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
  return {
    method: init.method ?? "GET",
    query: { cid: init.cid ?? VALID_CID },
    headers: {},
  };
}

type Handler = typeof handler;
const call = (req: ReturnType<typeof mockReq>, res: MockRes) =>
  handler(req as unknown as Parameters<Handler>[0], res as unknown as Parameters<Handler>[1]);

const VALID_CID = "bafkreid7qoywk77r7rj3slobqfekdvs57qwuwh5d2z3sqsw52iabe3mqne";
const IMMUTABLE = "public, s-maxage=31536000, max-age=31536000, immutable";

describe("/api/ipfs/[cid]", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("fetches a valid CID via a gateway and returns it with an immutable cache header", async () => {
    const payload = JSON.stringify({ title: "Enable Raiko2 on mainnet" });
    let requestedUrl = "";
    globalThis.fetch = (async (input: unknown) => {
      requestedUrl = typeof input === "string" ? input : (input as Request).url;
      return new Response(payload, { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(requestedUrl).toContain(`/${VALID_CID}`);
    expect(res.headers["cache-control"]).toBe(IMMUTABLE);
    expect(res.headers["content-type"]).toBe("application/json");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect((res.body as Buffer).toString("utf8")).toBe(payload);
  });

  test("relays opaque (encrypted, non-JSON) bytes unchanged", async () => {
    const ciphertext = new Uint8Array([0x00, 0x01, 0xff, 0xfe, 0x42]);
    globalThis.fetch = (async () =>
      new Response(ciphertext, {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      })) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(Uint8Array.from(res.body as Buffer)).toEqual(ciphertext);
  });

  test("races gateways: succeeds even when some gateways fail", async () => {
    let calls = 0;
    globalThis.fetch = (async (input: unknown) => {
      calls++;
      const url = typeof input === "string" ? input : (input as Request).url;
      // Only the pinata gateway succeeds; the rest 500.
      if (url.includes("gateway.pinata.cloud")) {
        return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
      }
      return new Response("nope", { status: 500 });
    }) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq(), res);

    expect(res.statusCode).toBe(200);
    expect((res.body as Buffer).toString("utf8")).toBe("ok");
    expect(calls).toBeGreaterThan(1);
  });

  test("rejects a non-CID path (SSRF guard) without contacting any gateway", async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("should not happen", { status: 200 });
    }) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq({ cid: "http://169.254.169.254/latest/meta-data" }), res);

    expect(fetched).toBe(false);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { reason: string } }).error.reason).toBe("BAD_REQUEST");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  test("rejects path traversal in the CID subpath", async () => {
    const res = mockRes();
    await call(mockReq({ cid: `${VALID_CID}/../secret` }), res);
    expect(res.statusCode).toBe(400);
  });

  test("returns no-store on a gateway failure (never caches an error)", async () => {
    globalThis.fetch = (async () => new Response("nope", { status: 502 })) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq(), res);

    expect(res.statusCode).toBe(502);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect((res.body as { error: { reason: string } }).error.reason).toBe("BAD_GATEWAY");
  });

  test("collapses scriptable content to an inert type and marks the response non-executable", async () => {
    globalThis.fetch = (async () =>
      new Response("<script>alert(document.cookie)</script>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq(), res);

    expect(res.statusCode).toBe(200);
    // Never echo text/html back from our own origin.
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toContain("sandbox");
  });

  test("rejects an oversized response (memory-DoS guard) without caching it", async () => {
    const huge = new Uint8Array(10 * 1024 * 1024 + 1);
    globalThis.fetch = (async () =>
      new Response(huge, {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      })) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq(), res);

    expect(res.statusCode).toBe(502);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  test("rejects non-GET methods", async () => {
    const res = mockRes();
    await call(mockReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
  });
});
