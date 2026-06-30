import { describe, it, expect } from "vitest";
import { encodeFunctionData, parseAbiItem, type AbiFunction } from "viem";
import { decodeAction } from "../decodeAction";
import type { AbiResolution, DecodeCtx } from "../types";

const executeAbi = parseAbiItem("function execute(bytes)") as AbiFunction;
const upgradeToAbi = parseAbiItem("function upgradeTo(address newImplementation)") as AbiFunction;
const transferAbi = parseAbiItem("function transfer(address to, uint256 amount)") as AbiFunction;

const CONTROLLER = "0x75Ba76403b13b26AD1beC70D6eE937314eeaCD0a" as const;
const PROXY = "0x6f21C543a4aF5189eBdb0723827577e1EF57ef1f" as const;
const ADDR = "0x000000000000000000000000000000000000dEaD" as const;
// Real on-chain calldata of community proposal #33, action 1 — execute(bytes) wrapping one upgradeTo sub-action.
const P33_DATA =
  "0x09c5eabe000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000006f21c543a4af5189ebdb0723827577e1ef57ef1f0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000243659cfe6000000000000000000000000349ae3578f48f758d79451eeab61cdd5fedd009800000000000000000000000000000000000000000000000000000000" as const;

function ctx(overrides: Partial<DecodeCtx> = {}): DecodeCtx {
  return {
    loadAbi: async (addr): Promise<AbiResolution> => {
      const abi = addr.toLowerCase() === CONTROLLER.toLowerCase() ? [executeAbi] : [upgradeToAbi];
      return { abi, trust: "verified", isProxy: addr.toLowerCase() === PROXY.toLowerCase(), implementation: null };
    },
    loadSignature: async () => null,
    loadToken: async () => null,
    chainId: 1,
    depth: 0,
    maxDepth: 4,
    seen: new Set(),
    ...overrides,
  };
}

describe("decodeAction recursion / breadth guards", () => {
  it("stops at maxDepth and marks truncated='depth'", async () => {
    const node = await decodeAction({ to: CONTROLLER, value: 0n, data: P33_DATA }, ctx({ maxDepth: 0 }));
    expect(node.functionName).toBe("execute");
    expect(node.summary).toBe("Executes 1 sub-action(s)");
    expect(node.truncated).toBe("depth");
    expect(node.children).toHaveLength(0);
  });

  it("stops at the node budget and marks truncated='budget'", async () => {
    const node = await decodeAction(
      { to: CONTROLLER, value: 0n, data: P33_DATA },
      ctx({ maxNodes: 0, nodeCount: { value: 0 } }),
    );
    expect(node.truncated).toBe("budget");
    expect(node.children).toHaveLength(0);
  });

  it("skips an already-seen (cyclic) sub-call and marks truncated='cycle'", async () => {
    // Discover the child's identity from a clean decode, then re-decode with that
    // key pre-seeded into `seen` to simulate the call reappearing in its own subtree.
    const clean = await decodeAction({ to: CONTROLLER, value: 0n, data: P33_DATA }, ctx());
    const child = clean.children[0];
    const key = `${child.to}:${child.data}`.toLowerCase();

    const node = await decodeAction({ to: CONTROLLER, value: 0n, data: P33_DATA }, ctx({ seen: new Set([key]) }));
    expect(node.truncated).toBe("cycle");
    expect(node.children).toHaveLength(0);
  });

  it("propagates a child's retryable flag up to the parent (whole tree marked stale)", async () => {
    // Resolve the executor fine, but make the sub-action's target throw (transient
    // RPC failure). The child is retryable; the parent must inherit the flag so the
    // hook refetches the whole tree instead of caching a half-degraded result.
    const node = await decodeAction(
      { to: CONTROLLER, value: 0n, data: P33_DATA },
      ctx({
        loadAbi: async (addr): Promise<AbiResolution> => {
          if (addr.toLowerCase() === PROXY.toLowerCase()) throw new Error("rpc down");
          return { abi: [executeAbi], trust: "verified", isProxy: false, implementation: null };
        },
      }),
    );
    expect(node.children).toHaveLength(1);
    expect(node.children[0].retryable).toBe(true);
    expect(node.retryable).toBe(true);
  });

  it("degrades to the raw decoded node (error='unwrap-failed') when an unwrapper throws", async () => {
    const data = encodeFunctionData({ abi: [transferAbi], functionName: "transfer", args: [ADDR, 1000n] });
    const node = await decodeAction(
      { to: ADDR, value: 0n, data },
      ctx({
        loadAbi: async () => ({ abi: [transferAbi], trust: "verified", isProxy: false, implementation: null }),
        loadToken: async () => {
          throw new Error("rpc boom");
        },
      }),
    );
    expect(node.functionName).toBe("transfer");
    expect(node.params.map((p) => p.name)).toEqual(["to", "amount"]);
    expect(node.error).toBe("unwrap-failed");
    expect(node.children).toHaveLength(0);
  });
});
