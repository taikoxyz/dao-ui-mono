import { PUB_CHAIN } from "@/constants";
import { formatHexString } from "@/utils/evm";
import { decodeCamelCase } from "@/utils/case";
import { InputText } from "@aragon/ods";
import Link from "next/link";
import { formatEther } from "viem";
import type { DecodedNode } from "@/utils/decoding/types";
import { EncodedView } from "./encodedView";
import { TrustBadge } from "./trustBadge";

function paramDisplay(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(paramDisplay).join(", ");
  if (value && typeof value === "object")
    return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return String(value);
}

// Group consecutive children sharing the same target + selector into an expandable
// fold. Every call is still rendered individually so distinct args are never hidden;
// only byte-identical calls (same `data` + `to`) collapse to a single "×N identical" item.
type GroupItem = { node: DecodedNode; count: number };
type ChildGroup = {
  to: string;
  selector: string | null;
  functionName: string | null;
  total: number;
  items: GroupItem[];
};

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

export const ActionNode: React.FC<{ node: DecodedNode; depth?: number }> = ({ node, depth = 0 }) => {
  const explorerUrl = `${PUB_CHAIN.blockExplorers?.default.url}/address/${node.to}`;
  const title = node.functionName
    ? decodeCamelCase(node.functionName)
    : node.selector
      ? "(unrecognized call)"
      : `Transfer ${PUB_CHAIN.nativeCurrency.symbol}`;
  const indent = depth > 0 ? "border-l border-neutral-100 pl-4 md:pl-6" : "";

  return (
    <div className={`flex flex-col gap-y-3 ${indent}`}>
      <div className="flex flex-col gap-y-1">
        <span className="text-lg leading-tight text-neutral-800 md:text-xl">{title}</span>
        <div className="flex items-center gap-x-3">
          <Link href={explorerUrl} target="_blank" className="text-neutral-500">
            {formatHexString(node.to)}
          </Link>
          <TrustBadge trust={node.trust} />
        </div>
        {node.summary && <p className="md:text-md text-base text-neutral-600">{node.summary}</p>}
      </div>

      {/* Body: decoded params, or raw fallback */}
      {node.error || (!node.functionName && !node.summary) ? (
        <EncodedView rawAction={{ to: node.to, value: node.value, data: node.data }} />
      ) : (
        <div className="flex flex-col gap-y-2">
          {node.signature && <InputText label="Contract function" className="w-full" value={node.signature} disabled />}
          {node.params.map((p, i) => {
            // A bytes payload that was unwrapped into child calls is already shown as those
            // children (and via "Raw calldata"); don't also dump it as a giant hex field.
            if (p.type === "bytes" && node.children.length > 0) return null;
            const label = decodeCamelCase(p.name || `Parameter ${i + 1}`);
            if (p.type === "address") {
              const addr = String(p.value);
              return (
                <div key={i} className="flex flex-col gap-y-1">
                  <span className="text-sm text-neutral-500">{label}</span>
                  <Link
                    href={`${PUB_CHAIN.blockExplorers?.default.url}/address/${addr}`}
                    target="_blank"
                    className="break-all text-sm text-primary-500 underline"
                  >
                    {addr}
                  </Link>
                </div>
              );
            }
            const v = p.formatted ?? paramDisplay(p.value);
            if (v.length > 42) {
              // Long values (hashes, byte strings) wrap and scroll instead of being clipped.
              return (
                <div key={i} className="flex flex-col gap-y-1">
                  <span className="text-sm text-neutral-500">{label}</span>
                  <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-md bg-neutral-50 p-2 text-xs text-neutral-700">
                    {v}
                  </pre>
                </div>
              );
            }
            return <InputText key={i} label={label} className="w-full" value={v} disabled />;
          })}
          {node.value > 0n && (
            <InputText
              label={`${PUB_CHAIN.nativeCurrency.symbol} value`}
              className="w-full"
              value={`${formatEther(node.value)} ${PUB_CHAIN.nativeCurrency.symbol}`}
              disabled
            />
          )}
          <details className="mt-1">
            <summary className="cursor-pointer text-sm text-neutral-500">Raw calldata</summary>
            <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-md bg-neutral-50 p-2 text-xs text-neutral-700">
              {node.data}
            </pre>
          </details>
        </div>
      )}

      {node.truncated && (
        <p className="text-sm text-warning-500">Nested calls hidden ({node.truncated}). View raw data on the explorer.</p>
      )}

      {/* Children */}
      {node.children.length > 0 && (
        <div className="flex flex-col gap-y-4">
          {groupChildren(node.children).map((group, i) => {
            // A single call renders inline with no group chrome.
            if (group.total === 1) {
              return <ActionNode key={i} node={group.items[0].node} depth={depth + 1} />;
            }
            // A run of ≥2 calls renders an expandable fold with every call inside.
            const groupExplorerUrl = `${PUB_CHAIN.blockExplorers?.default.url}/address/${group.to}`;
            return (
              <details key={i} open className="flex flex-col gap-y-2">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-neutral-700">
                  <span className="text-base text-neutral-800">{decodeCamelCase(group.functionName ?? "(call)")}</span>
                  <span className="text-sm text-neutral-500">— {group.total} calls</span>
                  <Link href={groupExplorerUrl} target="_blank" className="text-sm text-neutral-500">
                    {formatHexString(group.to)}
                  </Link>
                  <TrustBadge trust={group.items[0].node.trust} />
                </summary>
                <div className="mt-2 flex flex-col gap-y-4">
                  {group.items.map((item, j) => (
                    <div key={j} className="flex flex-col gap-y-1">
                      {item.count > 1 && (
                        <span className="text-sm text-neutral-500">×{item.count} identical</span>
                      )}
                      <ActionNode node={item.node} depth={depth + 1} />
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
};
