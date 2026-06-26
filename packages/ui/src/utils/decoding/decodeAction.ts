import { slice, toFunctionSelector, toFunctionSignature, decodeFunctionData, formatEther, type AbiFunction } from "viem";
import type { DecodeCtx, DecodedNode, RawCall } from "./types";
import { matchUnwrapper } from "./unwrappers";

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

  const unwrapper = matchUnwrapper(node);
  if (unwrapper) {
    const { summary, children } = await unwrapper.apply(node, ctx);
    node.summary = summary;
    if (children.length) {
      if (ctx.depth >= ctx.maxDepth) {
        node.truncated = "depth";
      } else {
        for (const child of children) {
          const key = `${child.to}:${child.data}`.toLowerCase();
          if (ctx.seen.has(key)) {
            node.truncated = "cycle";
            continue;
          }
          const childCtx = { ...ctx, depth: ctx.depth + 1, seen: new Set(ctx.seen).add(key) };
          node.children.push(await decodeAction(child, childCtx));
        }
      }
    }
  }

  return node;
}
