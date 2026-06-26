import { describe, it, expect, vi } from "vitest";
import { loadSignatureFrom } from "../signatureLookup";

const okResponse = (name: string, selector: string) =>
  ({ ok: true, json: async () => ({ ok: true, result: { function: { [selector]: [{ name }] } } }) }) as any;

describe("loadSignatureFrom", () => {
  it("returns an AbiFunction fragment for a known selector", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse("pause()", "0x8456cb59"));
    const fn = await loadSignatureFrom(fetchImpl, "0x8456cb59");
    expect(fn?.name).toBe("pause");
    expect(fn?.type).toBe("function");
    expect(fn?.inputs).toEqual([]);
  });

  it("parses arguments", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse("transferOwnership(address)", "0xf2fde38b"));
    const fn = await loadSignatureFrom(fetchImpl, "0xf2fde38b");
    expect(fn?.name).toBe("transferOwnership");
    expect(fn?.inputs?.[0]?.type).toBe("address");
  });

  it("returns null when nothing matches", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, result: { function: {} } }) } as any);
    const fn = await loadSignatureFrom(fetchImpl, "0xdeadbeef");
    expect(fn).toBeNull();
  });

  it("returns null on network error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("boom"));
    const fn = await loadSignatureFrom(fetchImpl, "0xdeadbeef");
    expect(fn).toBeNull();
  });
});
