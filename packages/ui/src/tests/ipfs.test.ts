import { afterEach, describe, expect, test } from "bun:test";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import { fetchIpfsAsJson, setIpfsEndpointsForTests, uploadToPinata } from "../utils/ipfs";

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
    expect(calledUrl).toBe("/api/pin/");
    expect(calledInit?.method).toBe("POST");
    // The browser must never carry a Pinata credential
    const headers = new Headers(calledInit?.headers);
    expect(headers.get("authorization")).toBeNull();
  });
});

describe("fetchIpfsAsJson client-side verification", () => {
  const originalFetch = globalThis.fetch;
  const metadata = JSON.stringify({ title: "Enable Raiko2 on mainnet" });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setIpfsEndpointsForTests(null);
  });

  async function rawCidFor(content: string): Promise<string> {
    const digest = await sha256.digest(new TextEncoder().encode(content));
    return CID.create(1, raw.code, digest).toString();
  }

  function jsonResponse(body: string): Response {
    return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  }

  test("serves bytes that match the raw CID", async () => {
    const cid = await rawCidFor(metadata);
    setIpfsEndpointsForTests(["/api/ipfs"]);
    globalThis.fetch = (async () => jsonResponse(metadata)) as unknown as typeof fetch;

    const data = await fetchIpfsAsJson(`ipfs://${cid}`);
    expect(data.title).toBe("Enable Raiko2 on mainnet");
  });

  test("rejects tampered bytes and falls back to the next endpoint", async () => {
    const cid = await rawCidFor(metadata);
    const calledUrls: string[] = [];
    setIpfsEndpointsForTests(["/api/ipfs", "https://gateway.example/ipfs"]);
    globalThis.fetch = (async (input: unknown) => {
      calledUrls.push(String(input));
      // The first endpoint (our proxy) serves tampered content; the fallback
      // gateway serves the real bytes.
      return calledUrls.length === 1 ? jsonResponse(JSON.stringify({ title: "TAMPERED" })) : jsonResponse(metadata);
    }) as unknown as typeof fetch;

    const data = await fetchIpfsAsJson(`ipfs://${cid}`);
    expect(data.title).toBe("Enable Raiko2 on mainnet");
    expect(calledUrls).toEqual([`/api/ipfs/${cid}`, `https://gateway.example/ipfs/${cid}`]);
  });

  test("fails instead of serving content when every endpoint is tampered", async () => {
    const cid = await rawCidFor(metadata);
    setIpfsEndpointsForTests(["/api/ipfs", "https://gateway.example/ipfs"]);
    globalThis.fetch = (async () => jsonResponse(JSON.stringify({ title: "TAMPERED" }))) as unknown as typeof fetch;

    await expect(fetchIpfsAsJson(`ipfs://${cid}`)).rejects.toThrow("Could not connect to any of the IPFS endpoints");
  });

  test("passes through shapes it cannot verify (dag-pb roots)", async () => {
    // A multi-block dag-pb CID: the browser cannot verify it against the file
    // bytes, so the response is served as-is (mirrors the server-side limit).
    const dagPbCid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    const calledUrls: string[] = [];
    setIpfsEndpointsForTests(["/api/ipfs"]);
    globalThis.fetch = (async (input: unknown) => {
      calledUrls.push(String(input));
      return jsonResponse(JSON.stringify({ title: "big proposal" }));
    }) as unknown as typeof fetch;

    const data = await fetchIpfsAsJson(`ipfs://${dagPbCid}`);
    expect(data.title).toBe("big proposal");
    expect(calledUrls).toHaveLength(1);
  });
});
