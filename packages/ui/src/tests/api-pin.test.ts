import { afterEach, describe, expect, test } from "bun:test";
import handler from "../pages/api/pin";

type MockRes = {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockRes;
  json: (payload: unknown) => MockRes;
};

function mockRes(): MockRes {
  return {
    statusCode: 200,
    body: undefined,
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

describe("/api/pin", () => {
  const originalFetch = globalThis.fetch;
  const originalJwt = process.env.PINATA_JWT;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalJwt === undefined) delete process.env.PINATA_JWT;
    else process.env.PINATA_JWT = originalJwt;
  });

  test("attaches the server-only JWT and relays the Pinata CID", async () => {
    process.env.PINATA_JWT = "server-secret-jwt";
    let pinataUrl = "";
    let pinataAuth = "";
    let sentBody: unknown;
    globalThis.fetch = (async (input: unknown, init: RequestInit) => {
      pinataUrl = typeof input === "string" ? input : ((input as Request)?.url ?? "");
      pinataAuth = new Headers(init?.headers).get("authorization") ?? "";
      sentBody = init?.body;
      return new Response(JSON.stringify({ IpfsHash: "bafyServer" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq({ body: { body: JSON.stringify({ title: "x" }) } }), res);

    expect(pinataUrl).toBe("https://api.pinata.cloud/pinning/pinFileToIPFS");
    expect(pinataAuth).toBe("Bearer server-secret-jwt");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ IpfsHash: "bafyServer" });
    // Multipart contract: a file part is sent (no reliance on global `File`)
    expect(sentBody).toBeInstanceOf(FormData);
    const form = sentBody as FormData;
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect(String(form.get("pinataMetadata"))).toContain("taiko.json");
  });

  test("relays Pinata error status and body unchanged", async () => {
    process.env.PINATA_JWT = "server-secret-jwt";
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: { reason: "FORBIDDEN", details: "Account blocked due to plan usage limit" },
        }),
        { status: 403, headers: { "content-type": "application/json" } }
      )) as unknown as typeof fetch;

    const res = mockRes();
    await call(mockReq(), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: { reason: "FORBIDDEN", details: "Account blocked due to plan usage limit" },
    });
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
