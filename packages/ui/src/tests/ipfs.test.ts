import { afterEach, describe, expect, test } from "bun:test";
import { uploadToPinata } from "../utils/ipfs";

describe("uploadToPinata", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("surfaces structured Pinata error details", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: {
            reason: "FORBIDDEN",
            details: "Account blocked due to plan usage limit",
          },
        }),
        {
          status: 403,
          headers: { "content-type": "application/json" },
        }
      )) as unknown as typeof fetch;

    await expect(uploadToPinata(JSON.stringify({ title: "Enable Raiko2 on mainnet" }))).rejects.toThrow(
      "Pinata upload failed (403): FORBIDDEN - Account blocked due to plan usage limit"
    );
  });

  test("uploads via the same-origin /api/pin proxy without exposing credentials", async () => {
    let calledUrl: string | undefined;
    let calledInit: RequestInit | undefined;
    globalThis.fetch = (async (input: unknown, init: RequestInit) => {
      calledUrl = typeof input === "string" ? input : (input as Request)?.url;
      calledInit = init;
      return new Response(JSON.stringify({ IpfsHash: "bafytest123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const uri = await uploadToPinata(JSON.stringify({ title: "Enable Raiko2 on mainnet" }));

    expect(uri).toBe("ipfs://bafytest123");
    expect(calledUrl).toBe("/api/pin");
    expect(calledInit?.method).toBe("POST");
    // The browser must never carry a Pinata credential
    const headers = new Headers(calledInit?.headers);
    expect(headers.get("authorization")).toBeNull();
  });
});
