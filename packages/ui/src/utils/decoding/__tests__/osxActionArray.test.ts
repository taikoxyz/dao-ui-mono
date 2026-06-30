import { describe, it, expect, vi, beforeEach } from "vitest";
import { encodeAbiParameters, encodeFunctionData, parseAbiItem, parseAbiParameters, type AbiFunction, type Hex } from "viem";
import { decodeAction } from "../decodeAction";
import { MAX_ACTION_ELEMENTS } from "../unwrappers/actionArray";
import type { AbiResolution, DecodeCtx } from "../types";

// Control the executor identity gate per-test. Defaults to permissive (true),
// matching the real test env where PUB_DAO_ADDRESS is unset (isKnownExecutor
// returns true for an empty set). Prod enforces node.to === DAO; that branch is
// not unit-testable without env, so we mock the gate to prove it is wired.
const { isKnownExecutorMock } = vi.hoisted(() => ({ isKnownExecutorMock: vi.fn((_node: unknown) => true) }));
vi.mock("../knownContracts", () => ({
  isKnownExecutor: (node: unknown) => isKnownExecutorMock(node),
  isKnownBridge: () => false,
}));

const executeAbi = parseAbiItem("function execute(bytes)") as AbiFunction;
const upgradeToAbi = parseAbiItem("function upgradeTo(address newImplementation)") as AbiFunction;
const storeAbi = parseAbiItem("function store(bytes)") as AbiFunction;
const actionTuple = parseAbiParameters("(address,uint256,bytes)[]");

const CONTROLLER = "0x75Ba76403b13b26AD1beC70D6eE937314eeaCD0a" as const;
const PROXY = "0x6f21C543a4aF5189eBdb0723827577e1EF57ef1f" as const;
// Real on-chain calldata of community proposal #33, action 1:
const P33_DATA =
  "0x09c5eabe000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000006f21c543a4af5189ebdb0723827577e1ef57ef1f0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000243659cfe6000000000000000000000000349ae3578f48f758d79451eeab61cdd5fedd009800000000000000000000000000000000000000000000000000000000" as const;

function ctx(overrides: Partial<DecodeCtx> = {}): DecodeCtx {
  return {
    loadAbi: async (addr): Promise<AbiResolution> => {
      const abi = addr.toLowerCase() === CONTROLLER.toLowerCase() ? [executeAbi] : [upgradeToAbi];
      return { abi, trust: "verified", isProxy: addr.toLowerCase() === PROXY.toLowerCase(), implementation: null };
    },
    loadToken: async () => null,
    chainId: 1,
    depth: 0,
    maxDepth: 4,
    seen: new Set(),
    ...overrides,
  };
}

describe("osx-action-array unwrapper (real #33 calldata)", () => {
  beforeEach(() => {
    isKnownExecutorMock.mockReset();
    isKnownExecutorMock.mockReturnValue(true);
  });

  it("expands execute(bytes) into its sub-actions and summarizes", async () => {
    const node = await decodeAction({ to: CONTROLLER, value: 0n, data: P33_DATA }, ctx());
    expect(node.functionName).toBe("execute");
    expect(node.summary).toBe("Executes 1 sub-action(s)");
    expect(node.children).toHaveLength(1);
    const child = node.children[0];
    expect(child.to.toLowerCase()).toBe(PROXY.toLowerCase());
    expect(child.functionName).toBe("upgradeTo");
    expect((child.params[0].value as string).toLowerCase()).toBe("0x349ae3578f48f758d79451eeab61cdd5fedd0098");
  });

  it("does not mistake a random bytes blob for an action array", async () => {
    const data =
      "0x09c5eabe" +
      "0000000000000000000000000000000000000000000000000000000000000020" +
      "0000000000000000000000000000000000000000000000000000000000000004" +
      "deadbeef00000000000000000000000000000000000000000000000000000000";
    const node = await decodeAction({ to: CONTROLLER, value: 0n, data: data as `0x${string}` }, ctx());
    expect(node.children).toHaveLength(0);
  });

  it("does not expand action-shaped bytes on non-executor functions", async () => {
    const blob = encodeAbiParameters(actionTuple, [[[PROXY, 0n, "0x3659cfe6"]]]);
    const data = encodeFunctionData({ abi: [storeAbi], functionName: "store", args: [blob] });
    const decodeCtx: DecodeCtx = {
      ...ctx(),
      loadAbi: async (): Promise<AbiResolution> => ({
        abi: [storeAbi],
        trust: "verified",
        isProxy: false,
        implementation: null,
      }),
    };

    const node = await decodeAction({ to: CONTROLLER, value: 0n, data }, decodeCtx);

    expect(node.functionName).toBe("store");
    expect(node.summary).toBeNull();
    expect(node.children).toHaveLength(0);
  });

  it("gates expansion on executor identity: a non-executor target is not confidently expanded", async () => {
    // Simulate prod where node.to is NOT the DAO executor: the gate rejects the
    // confident match, so execute(bytes) degrades to a raw node (no children, no
    // 'Executes N…' summary) — a foreign contract isn't dressed up as a batch.
    isKnownExecutorMock.mockReturnValue(false);
    const node = await decodeAction({ to: CONTROLLER, value: 0n, data: P33_DATA }, ctx());
    expect(node.functionName).toBe("execute");
    expect(node.summary).toBeNull();
    expect(node.children).toHaveLength(0);
    expect(isKnownExecutorMock).toHaveBeenCalledWith(expect.objectContaining({ to: CONTROLLER }));
  });

  it("caps an oversized action array at MAX_ACTION_ELEMENTS and marks truncated", async () => {
    // High node budget so the per-array element cap (not the tree budget) is the
    // binding constraint, isolating M4's array-level cap.
    const tuple = parseAbiParameters("(address,uint256,bytes)[]");
    const items = Array.from({ length: MAX_ACTION_ELEMENTS + 6 }, () => [PROXY, 0n, "0x"] as [Hex, bigint, Hex]);
    const blob = encodeAbiParameters(tuple, [items]);
    const data = encodeFunctionData({ abi: [parseAbiItem("function execute(bytes)") as AbiFunction], functionName: "execute", args: [blob] });

    const node = await decodeAction(
      { to: CONTROLLER, value: 0n, data },
      ctx({ maxNodes: 500, nodeCount: { value: 0 } }),
    );

    expect(node.summary).toBe(`Executes ${MAX_ACTION_ELEMENTS} sub-action(s)`);
    expect(node.children).toHaveLength(MAX_ACTION_ELEMENTS);
    expect(node.truncated).toBe("budget");
  });
});
