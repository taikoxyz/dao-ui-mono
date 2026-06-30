import { slice, size, toFunctionSelector, toFunctionSignature, decodeFunctionData, formatEther, type AbiFunction } from "viem";
import type { DecodeCtx, DecodedNode, RawCall } from "./types";
import { matchUnwrapper } from "./unwrappers";
import { buildParams } from "./params";

// Default ceiling on the total number of decoded sub-nodes per tree. Each node
// drives an RPC + Etherscan fetch, so this is a real network-fan-out bound, kept
// well below the per-array element cap (MAX_ACTION_ELEMENTS) so an oversized
// batch always trips the shared budget and gets honestly marked truncated.
const DEFAULT_MAX_NODES = 48;

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

  // Shared tree-wide breadth budget for child recursion (a hostile action array
  // must not drive unbounded RPC fan-out once the node budget is exhausted).
  const maxNodes = ctx.maxNodes ?? DEFAULT_MAX_NODES;
  const nodeCount = ctx.nodeCount ?? { value: 0 };

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
    // loadAbi threw — a transient failure, not a clean unknown: flag refetchable.
    resolution = { abi: [], trust: "unknown" as const, isProxy: false, implementation: null, retryable: true };
  }
  node.trust = resolution.trust;
  node.isProxy = resolution.isProxy;
  node.implementation = resolution.implementation;
  node.name = resolution.name;
  node.proxyName = resolution.proxyName;
  node.retryable = resolution.retryable;

  const fnAbi: AbiFunction | undefined = resolution.abi.find(
    (f) => f.type === "function" && node.selector === toFunctionSelector(f),
  );

  if (fnAbi) {
    try {
      const { args } = decodeFunctionData({ abi: [fnAbi], data: call.data });
      node.functionName = fnAbi.name;
      node.signature = toFunctionSignature(fnAbi);
      node.params = buildParams(fnAbi.inputs, args as readonly unknown[]);
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

  // A transient failure anywhere in the subtree taints the whole tree as stale,
  // so the hook refetches rather than caching a partial degraded result.
  if (node.children.some((c) => c.retryable)) node.retryable = true;

  return node;
}
