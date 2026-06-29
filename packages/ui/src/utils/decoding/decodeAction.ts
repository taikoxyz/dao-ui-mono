import { slice, size, toFunctionSelector, toFunctionSignature, decodeFunctionData, formatEther, type AbiFunction } from "viem";
import type { DecodeCtx, DecodedNode, RawCall } from "./types";
import { matchUnwrapper } from "./unwrappers";

// Default ceiling on the total number of decoded sub-nodes per tree.
const DEFAULT_MAX_NODES = 256;

function baseNode(call: RawCall): DecodedNode {
  return {
    to: call.to,
    value: call.value,
    data: call.data,
    chainId: call.chainId ?? 1,
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
  node.chainId = call.chainId ?? ctx.chainId;

  if (!call.data || call.data === "0x") {
    node.trust = "verified";
    node.summary = `Transfer ${formatEther(call.value)} to ${call.to}`;
    return node;
  }

  if (size(call.data) < 4) {
    node.error = "invalid-calldata";
    return node;
  }

  node.selector = slice(call.data, 0, 4);

  let resolution;
  try {
    resolution = await ctx.loadAbi(call.to, node.chainId);
  } catch (err) {
    console.warn(`decodeAction: ABI resolution failed for ${call.to}`, err);
    resolution = { abi: [], trust: "unknown" as const, isProxy: false, implementation: null };
  }
  node.trust = resolution.trust;
  node.isProxy = resolution.isProxy;
  node.implementation = resolution.implementation;
  node.name = resolution.name;
  node.proxyName = resolution.proxyName;

  let fnAbi: AbiFunction | undefined = resolution.abi.find(
    (f) => f.type === "function" && node.selector === toFunctionSelector(f),
  );

  if (!fnAbi) {
    const frag = await ctx.loadSignature(node.selector);
    if (frag) {
      fnAbi = frag;
      node.trust = "signature-db";
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
    let summary: string | null = null;
    let children: RawCall[] = [];
    try {
      ({ summary, children } = await unwrapper.apply(node, ctx));
    } catch {
      // A heuristic unwrapper threw on an unexpected param shape (selector-only
      // matches can reach apply() with empty/typed-wrong params). Degrade to the
      // raw decoded node instead of rejecting the whole query — otherwise the
      // action would be stuck on "Decoding…". `error` makes the UI fall back to
      // the raw calldata view.
      if (!node.error) node.error = "unwrap-failed";
      return node;
    }
    node.summary = summary;
    if (children.length) {
      if (ctx.depth >= ctx.maxDepth) {
        node.truncated = "depth";
      } else {
        const maxNodes = ctx.maxNodes ?? DEFAULT_MAX_NODES;
        const nodeCount = ctx.nodeCount ?? { value: 0 };
        for (const child of children) {
          if (nodeCount.value >= maxNodes) {
            node.truncated = "budget";
            break;
          }
          const key = `${child.to}:${child.data}`.toLowerCase();
          if (ctx.seen.has(key)) {
            node.truncated = "cycle";
            continue;
          }
          nodeCount.value += 1;
          const childCtx = {
            ...ctx,
            depth: ctx.depth + 1,
            seen: new Set(ctx.seen).add(key),
            maxNodes,
            nodeCount,
          };
          node.children.push(await decodeAction(child, childCtx));
        }
      }
    }
  }

  return node;
}
