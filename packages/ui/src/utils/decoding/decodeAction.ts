import { slice, toFunctionSelector, toFunctionSignature, decodeFunctionData, formatEther, type AbiFunction } from "viem";
import type { DecodeCtx, DecodedNode, RawCall } from "./types";

function baseNode(call: RawCall): DecodedNode {
  return {
    to: call.to,
    value: call.value,
    data: call.data,
    selector: null,
    functionName: null,
    signature: null,
    params: [],
    trust: "unknown",
    isProxy: false,
    implementation: null,
    summary: null,
    children: [],
  };
}

export async function decodeAction(call: RawCall, ctx: DecodeCtx): Promise<DecodedNode> {
  const node = baseNode(call);

  if (!call.data || call.data === "0x") {
    node.trust = "verified";
    node.summary = `Transfer ${formatEther(call.value)} to ${call.to}`;
    return node;
  }

  node.selector = slice(call.data, 0, 4);

  let resolution;
  try {
    resolution = await ctx.loadAbi(call.to);
  } catch {
    resolution = { abi: [], trust: "unknown" as const, isProxy: false, implementation: null };
  }
  node.trust = resolution.trust;
  node.isProxy = resolution.isProxy;
  node.implementation = resolution.implementation;

  let fnAbi: AbiFunction | undefined = resolution.abi.find(
    (f) => f.type === "function" && node.selector === toFunctionSelector(f),
  );

  if (!fnAbi) {
    const frag = await ctx.loadSignature(node.selector);
    if (frag) {
      fnAbi = frag;
      if (resolution.trust === "unknown") node.trust = "signature-db";
    }
  }

  if (fnAbi) {
    try {
      const { args } = decodeFunctionData({ abi: [fnAbi], data: call.data });
      node.functionName = fnAbi.name;
      node.signature = toFunctionSignature(fnAbi);
      node.params = fnAbi.inputs.map((inp, i) => ({
        name: inp.name ?? "",
        type: inp.type,
        value: (args as readonly unknown[])[i] as DecodedNode["params"][number]["value"],
      }));
    } catch {
      node.error = "decode-failed";
    }
  } else {
    node.error = "no-abi";
  }

  return node;
}
