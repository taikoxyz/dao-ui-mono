import { PUB_CHAIN } from "@/constants";
import { formatHexString } from "@/utils/evm";
import { decodeCamelCase } from "@/utils/case";
import Link from "next/link";
import { formatEther } from "viem";
import type { DecodedNode, DecodedParam } from "@/utils/decoding/types";
import { EncodedView } from "./encodedView";
import { TrustBadge } from "./trustBadge";
import { CopyButton } from "@/components/copy/copyButton";

// ---------- helpers ----------

function shortHex(v: string): string {
  return v.startsWith("0x") && v.length > 14 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v;
}

function paramDisplay(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(paramDisplay).join(", ");
  if (value && typeof value === "object")
    return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return String(value);
}

/**
 * Plain-English "impact" lead for a call. Priority:
 *  1. a recognized-pattern summary (upgrade / transfer / ownership / batch)
 *  2. a `set<Thing>Trusted(id, bool)` heuristic → "Trust/Untrust <thing> <id>"
 *  3. the friendly function name (never invented)
 */
type Lead = { text: string; hex?: string };

/** Structured lead so the embedded identifier (a key/hash, not an address) can be made copyable. */
function leadParts(node: DecodedNode): Lead {
  if (node.summary) return { text: node.summary };
  const fn = node.functionName;
  if (!fn) return { text: node.selector ? "Unrecognized call" : `Transfer ${PUB_CHAIN.nativeCurrency.symbol}` };

  const boolParam = node.params.find((p) => p.type === "bool");
  if (/trusted$/i.test(fn) && boolParam) {
    const subject = decodeCamelCase(fn.replace(/^set/i, "").replace(/trusted$/i, "")).toLowerCase().trim();
    const idParam = node.params.find((p) => p.type !== "bool");
    const verb = boolParam.value ? "Trust" : "Untrust";
    return { text: `${verb} ${subject}`.trim(), hex: idParam ? String(idParam.value) : undefined };
  }
  return { text: decodeCamelCase(fn) };
}

export function leadText(node: DecodedNode): string {
  const l = leadParts(node);
  return l.hex ? `${l.text} ${shortHex(l.hex)}` : l.text;
}

/** Precise call identifier pinned to the right of each item, e.g. "setX · 3/9". */
function callTag(node: DecodedNode, index: number, total: number, count: number): string {
  const fn = node.functionName ?? node.selector ?? "call";
  if (total <= 1) return fn;
  const range = count > 1 ? `${index}–${index + count - 1}` : `${index}`;
  return `${fn} · ${range}/${total}`;
}

// Group consecutive children sharing target + selector into a fold. Distinct calls are
// always rendered individually; only byte-identical (`data` + `to`) calls collapse to ×N.
type GroupItem = { node: DecodedNode; count: number };
type ChildGroup = { to: string; selector: string | null; functionName: string | null; total: number; items: GroupItem[] };

function groupChildren(children: DecodedNode[]): ChildGroup[] {
  const groups: ChildGroup[] = [];
  for (const child of children) {
    const last = groups[groups.length - 1];
    if (last && last.to === child.to && last.selector === child.selector) {
      last.total += 1;
      const lastItem = last.items[last.items.length - 1];
      if (lastItem && lastItem.node.data === child.data) lastItem.count += 1;
      else last.items.push({ node: child, count: 1 });
    } else {
      groups.push({
        to: child.to,
        selector: child.selector,
        functionName: child.functionName,
        total: 1,
        items: [{ node: child, count: 1 }],
      });
    }
  }
  return groups;
}

// ---------- small pieces ----------

export const AddressLink: React.FC<{ address: string; className?: string }> = ({ address, className = "" }) => (
  <span className="inline-flex items-center gap-x-1">
    <Link
      href={`${PUB_CHAIN.blockExplorers?.default.url}/address/${address}`}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      className={`font-mono text-neutral-500 hover:underline ${className}`}
    >
      {formatHexString(address)}
    </Link>
    <CopyButton value={address} />
  </span>
);

const ParamRow: React.FC<{ p: DecodedParam; idx: number }> = ({ p, idx }) => {
  // raw ABI parameter name, verbatim (preserve camelCase / underscores / casing)
  const label = p.name || `Parameter ${idx + 1}`;
  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 py-1 text-sm">
      <span className="whitespace-nowrap text-neutral-500">{label}</span>
      {p.type === "address" ? (
        <AddressLink address={String(p.value)} />
      ) : (
        <span className="flex min-w-0 items-start gap-x-1">
          <span className="break-all font-mono text-xs text-neutral-700">{p.formatted ?? paramDisplay(p.value)}</span>
          {String(p.value).length > 18 && <CopyButton value={String(p.value)} />}
        </span>
      )}
    </div>
  );
};

/** Collapsible "Call details": signature, decoded params, native value, raw calldata. */
const CallDetails: React.FC<{ node: DecodedNode }> = ({ node }) => {
  if (node.error || (!node.functionName && !node.summary)) {
    return <EncodedView rawAction={{ to: node.to, value: node.value, data: node.data }} />;
  }
  // a bytes payload that became children is shown as those children, not a hex wall
  const params = node.params.filter((p) => !(p.type === "bytes" && node.children.length > 0));
  const symbol = PUB_CHAIN.nativeCurrency.symbol;

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm text-primary-500">Inputs</summary>
      <div className="mt-2 flex flex-col gap-y-2">
        {node.signature && (
          <div className="font-mono text-xs text-neutral-500">
            Function: <span className="text-neutral-700">{node.signature}</span>
          </div>
        )}
        {params.length > 0 ? (
          <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-1">
            {params.map((p, i) => (
              <ParamRow key={i} p={p} idx={i} />
            ))}
          </div>
        ) : (
          <div className="text-sm text-neutral-500">No input parameters</div>
        )}
        {node.value > 0n && (
          <div className="text-sm text-neutral-600">
            {symbol} value: {formatEther(node.value)} {symbol}
          </div>
        )}
        <details>
          <summary className="cursor-pointer text-sm text-neutral-500">Raw calldata</summary>
          <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-md bg-neutral-50 p-2 text-xs text-neutral-700">
            {node.data}
          </pre>
        </details>
      </div>
    </details>
  );
};

/** One call rendered summary-first: impact lead + precise call tag, with details + any nested calls. */
const LeafItem: React.FC<{
  node: DecodedNode;
  index: number;
  total: number;
  count: number;
  depth: number;
  showTarget?: boolean;
}> = ({ node, index, total, count, depth, showTarget = true }) => {
  const flag = node.params.find((p) => p.type === "bool");
  const isDisable = flag != null && !flag.value;
  const accent = isDisable ? "border-l-warning-500" : "border-l-primary-400";
  const flagName = flag ? flag.name || "flag" : "";
  const lead = leadParts(node);

  return (
    <div className={`rounded-xl border border-neutral-100 border-l-[3px] bg-neutral-0 p-3 ${accent}`}>
      <div className="flex items-start gap-x-3">
        <span className="flex flex-wrap items-baseline gap-x-1.5 font-semibold leading-tight text-neutral-800">
          <span>{lead.text}</span>
          {lead.hex && (
            <span className="inline-flex items-center gap-x-1 font-mono">
              {shortHex(lead.hex)}
              <CopyButton value={lead.hex} />
            </span>
          )}
        </span>
        <span className="ml-auto shrink-0 rounded-md border border-neutral-100 bg-neutral-50 px-2 py-0.5 font-mono text-xs text-neutral-500">
          {callTag(node, index, total, count)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {showTarget && (
          <span className="inline-flex items-center gap-x-1 text-neutral-500">
            on <AddressLink address={node.to} />
          </span>
        )}
        <TrustBadge trust={node.trust} />
        {flag != null && (
          <span className={isDisable ? "text-warning-700" : "text-neutral-500"}>
            {flagName}: {String(flag.value)}
          </span>
        )}
        {count > 1 && <span className="text-success-600">×{count} identical</span>}
      </div>
      <CallDetails node={node} />
      {node.children.length > 0 && <ChildrenTree node={node} depth={depth + 1} />}
    </div>
  );
};

/** The grouped, recursive tree of a node's sub-calls. */
export const ChildrenTree: React.FC<{ node: DecodedNode; depth?: number }> = ({ node, depth = 0 }) => {
  const groups = groupChildren(node.children);
  const total = node.children.length;
  let pos = 0; // running 0-based index across all sub-calls (for the N/total tag)

  return (
    <div className="mt-3 flex flex-col gap-y-2 border-l border-neutral-100 pl-3 md:pl-4">
      {groups.map((group, gi) => {
        if (group.total === 1) {
          const idx = pos + 1;
          pos += 1;
          return <LeafItem key={gi} node={group.items[0].node} index={idx} total={total} count={1} depth={depth} />;
        }
        const groupExplorer = `${PUB_CHAIN.blockExplorers?.default.url}/address/${group.to}`;
        let ip = pos;
        pos += group.total;
        return (
          <details key={gi} open>
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 py-1">
              <span className="font-semibold text-neutral-800">{decodeCamelCase(group.functionName ?? "(call)")}</span>
              <span className="rounded-full bg-neutral-100 px-2 text-xs text-neutral-500">{group.total} calls</span>
              <span className="ml-auto flex items-center gap-x-2">
                <Link
                  href={groupExplorer}
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-sm text-neutral-500 hover:underline"
                >
                  {formatHexString(group.to)}
                </Link>
                <CopyButton value={group.to} />
                <TrustBadge trust={group.items[0].node.trust} />
              </span>
            </summary>
            <div className="mt-2 flex flex-col gap-y-2">
              {group.items.map((item, j) => {
                const idx = ip + 1;
                ip += item.count;
                return (
                  <LeafItem
                    key={j}
                    node={item.node}
                    index={idx}
                    total={total}
                    count={item.count}
                    depth={depth}
                    showTarget={false}
                  />
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
};

/**
 * Body of a top-level action (rendered under the accordion's rich header):
 * a leaf action shows its details; a wrapper action shows its sub-call tree.
 */
export const ActionNodeBody: React.FC<{ node: DecodedNode }> = ({ node }) => {
  if (node.children.length > 0) return <ChildrenTree node={node} depth={1} />;
  return <CallDetails node={node} />;
};

// Backwards-compatible default: a self-contained node (header + body).
export const ActionNode: React.FC<{ node: DecodedNode; depth?: number }> = ({ node }) => (
  <div className="flex flex-col gap-y-2">
    <div className="flex flex-col gap-y-1">
      <span className="text-lg font-semibold leading-tight text-neutral-800 md:text-xl">{leadText(node)}</span>
      <div className="flex items-center gap-x-3 text-sm">
        <AddressLink address={node.to} />
        <TrustBadge trust={node.trust} />
      </div>
    </div>
    <ActionNodeBody node={node} />
  </div>
);
