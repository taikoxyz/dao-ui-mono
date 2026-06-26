import { describe, it, expect } from "vitest";
import { parseAbiItem, type AbiFunction } from "viem";
import { decodeAction } from "../decodeAction";
import type { AbiResolution, DecodeCtx } from "../types";

const executeAbi = parseAbiItem("function execute(bytes)") as AbiFunction;
const upgradeToAbi = parseAbiItem("function upgradeTo(address newImplementation)") as AbiFunction;

const CONTROLLER = "0x75Ba76403b13b26AD1beC70D6eE937314eeaCD0a" as const;
const PROXY = "0x6f21C543a4aF5189eBdb0723827577e1EF57ef1f" as const;
// Real on-chain calldata of community proposal #33, action 1:
const P33_DATA =
  "0x09c5eabe000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000006f21c543a4af5189ebdb0723827577e1ef57ef1f0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000243659cfe6000000000000000000000000349ae3578f48f758d79451eeab61cdd5fedd009800000000000000000000000000000000000000000000000000000000" as const;

function ctx(): DecodeCtx {
  return {
    loadAbi: async (addr): Promise<AbiResolution> => {
      const abi = addr.toLowerCase() === CONTROLLER.toLowerCase() ? [executeAbi] : [upgradeToAbi];
      return { abi, trust: "verified", isProxy: addr.toLowerCase() === PROXY.toLowerCase(), implementation: null };
    },
    loadSignature: async () => null,
    loadToken: async () => null,
    depth: 0,
    maxDepth: 4,
    seen: new Set(),
  };
}

describe("osx-action-array unwrapper (real #33 calldata)", () => {
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
});
