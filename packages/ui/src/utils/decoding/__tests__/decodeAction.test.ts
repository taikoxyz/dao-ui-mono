import { describe, it, expect } from "vitest";
import { parseAbiItem, toFunctionSelector, encodeFunctionData, type AbiFunction } from "viem";
import { decodeAction } from "../decodeAction";
import type { AbiResolution, DecodeCtx } from "../types";

const transferAbi = parseAbiItem("function transfer(address to, uint256 amount)") as AbiFunction;

function ctx(overrides: Partial<DecodeCtx> = {}): DecodeCtx {
  return {
    loadAbi: async (): Promise<AbiResolution> => ({ abi: [transferAbi], trust: "verified", isProxy: false, implementation: null }),
    loadSignature: async () => null,
    loadToken: async () => null,
    chainId: 1,
    depth: 0,
    maxDepth: 4,
    seen: new Set(),
    ...overrides,
  };
}

const ADDR = "0x000000000000000000000000000000000000dEaD" as const;

describe("decodeAction (one level)", () => {
  it("treats empty data as a native transfer", async () => {
    const node = await decodeAction({ to: ADDR, value: 1n, data: "0x" }, ctx());
    expect(node.summary).toMatch(/Transfer/);
    expect(node.functionName).toBeNull();
    expect(node.trust).toBe("verified");
  });

  it("decodes a verified function call with named params", async () => {
    const data = encodeFunctionData({ abi: [transferAbi], functionName: "transfer", args: [ADDR, 1000n] });
    const node = await decodeAction({ to: ADDR, value: 0n, data }, ctx());
    expect(node.functionName).toBe("transfer");
    expect(node.signature).toBe("transfer(address,uint256)");
    expect(node.params.map((p) => p.name)).toEqual(["to", "amount"]);
    expect(node.params[1].value).toBe(1000n);
    expect(node.selector).toBe(toFunctionSelector(transferAbi));
    expect(node.trust).toBe("verified");
  });

  it("falls back to signature DB when the ABI lacks the selector", async () => {
    const pause = parseAbiItem("function pause()") as AbiFunction;
    const data = encodeFunctionData({ abi: [pause], functionName: "pause", args: [] });
    const node = await decodeAction(
      { to: ADDR, value: 0n, data },
      ctx({ loadAbi: async () => ({ abi: [], trust: "unknown", isProxy: false, implementation: null }), loadSignature: async () => pause }),
    );
    expect(node.functionName).toBe("pause");
    expect(node.trust).toBe("signature-db");
  });

  it("labels signature DB fallback as unverified even when another ABI source loaded", async () => {
    const pause = parseAbiItem("function pause()") as AbiFunction;
    const data = encodeFunctionData({ abi: [pause], functionName: "pause", args: [] });
    const node = await decodeAction({ to: ADDR, value: 0n, data }, ctx({ loadSignature: async () => pause }));

    expect(node.functionName).toBe("pause");
    expect(node.trust).toBe("signature-db");
  });

  it("returns an error node for calldata shorter than a selector", async () => {
    const node = await decodeAction({ to: ADDR, value: 0n, data: "0x1234" }, ctx());
    expect(node.error).toBeTruthy();
    expect(node.functionName).toBeNull();
    expect(node.children).toEqual([]);
  });

  it("returns an error node when nothing can decode", async () => {
    const node = await decodeAction(
      { to: ADDR, value: 0n, data: "0x12345678" },
      ctx({ loadAbi: async () => ({ abi: [], trust: "unknown", isProxy: false, implementation: null }) }),
    );
    expect(node.functionName).toBeNull();
    expect(node.error).toBeTruthy();
    expect(node.trust).toBe("unknown");
  });

  it("copies contract name and proxyName from the resolution onto the node", async () => {
    const data = encodeFunctionData({ abi: [transferAbi], functionName: "transfer", args: [ADDR, 1n] });
    const node = await decodeAction(
      { to: ADDR, value: 0n, data },
      ctx({
        loadAbi: async (): Promise<AbiResolution> => ({
          abi: [transferAbi],
          trust: "verified",
          isProxy: true,
          implementation: ADDR,
          name: "OptimisticTokenVotingPlugin",
          proxyName: "ERC1967Proxy",
        }),
      }),
    );
    expect(node.name).toBe("OptimisticTokenVotingPlugin");
    expect(node.proxyName).toBe("ERC1967Proxy");
  });

  it("leaves name undefined when the resolution has none", async () => {
    const data = encodeFunctionData({ abi: [transferAbi], functionName: "transfer", args: [ADDR, 1n] });
    const node = await decodeAction({ to: ADDR, value: 0n, data }, ctx());
    expect(node.name).toBeUndefined();
    expect(node.proxyName).toBeUndefined();
  });

  it("defaults node.chainId to ctx.chainId and passes it to loadAbi", async () => {
    let seenChainId: number | undefined;
    const data = encodeFunctionData({ abi: [transferAbi], functionName: "transfer", args: [ADDR, 1n] });
    const node = await decodeAction(
      { to: ADDR, value: 0n, data },
      ctx({
        chainId: 1,
        loadAbi: async (_addr, chainId): Promise<AbiResolution> => {
          seenChainId = chainId;
          return { abi: [transferAbi], trust: "verified", isProxy: false, implementation: null };
        },
      }),
    );
    expect(node.chainId).toBe(1);
    expect(seenChainId).toBe(1);
  });

  it("labels a selector-prefixed bytes param via the signature DB, marked unverified (no children)", async () => {
    const sendAbi = parseAbiItem("function store(bytes data)") as AbiFunction;
    const inner = ("0x7f07c947" + "00".repeat(32)) as `0x${string}`;
    const data = encodeFunctionData({ abi: [sendAbi], functionName: "store", args: [inner] });
    const pinged = parseAbiItem("function onMessageInvocation(bytes)") as AbiFunction;
    const node = await decodeAction(
      { to: ADDR, value: 0n, data },
      ctx({
        loadAbi: async (): Promise<AbiResolution> => ({ abi: [sendAbi], trust: "verified", isProxy: false, implementation: null }),
        loadSignature: async () => pinged,
      }),
    );
    expect(node.embeddedCalls?.[0]).toMatchObject({ path: "data", selector: "0x7f07c947", signature: "onMessageInvocation(bytes)" });
  });

  it("marks the node retryable when loadAbi throws (transient failure, not a clean unknown)", async () => {
    const data = encodeFunctionData({ abi: [transferAbi], functionName: "transfer", args: [ADDR, 1n] });
    const node = await decodeAction(
      { to: ADDR, value: 0n, data },
      ctx({
        loadAbi: async () => {
          throw new Error("rpc down");
        },
      }),
    );
    expect(node.retryable).toBe(true);
    expect(node.trust).toBe("unknown");
  });

  it("copies retryable from a degraded resolution (resolver caught a network throw)", async () => {
    const data = encodeFunctionData({ abi: [transferAbi], functionName: "transfer", args: [ADDR, 1n] });
    const node = await decodeAction(
      { to: ADDR, value: 0n, data },
      ctx({ loadAbi: async () => ({ abi: [], trust: "unknown", isProxy: false, implementation: null, retryable: true }) }),
    );
    expect(node.retryable).toBe(true);
  });

  it("leaves retryable unset for a clean unknown (verified-but-empty / non-contract)", async () => {
    const node = await decodeAction(
      { to: ADDR, value: 0n, data: "0x12345678" },
      ctx({ loadAbi: async () => ({ abi: [], trust: "unknown", isProxy: false, implementation: null }) }),
    );
    expect(node.retryable).toBeFalsy();
  });

  it("uses an explicit call.chainId for the node and the loadAbi lookup", async () => {
    let seenChainId: number | undefined;
    const data = encodeFunctionData({ abi: [transferAbi], functionName: "transfer", args: [ADDR, 1n] });
    const node = await decodeAction(
      { to: ADDR, value: 0n, data, chainId: 167000 },
      ctx({
        chainId: 1,
        loadAbi: async (_addr, chainId): Promise<AbiResolution> => {
          seenChainId = chainId;
          return { abi: [transferAbi], trust: "verified", isProxy: false, implementation: null };
        },
      }),
    );
    expect(node.chainId).toBe(167000);
    expect(seenChainId).toBe(167000);
  });
});
