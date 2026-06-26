import { PUB_CHAIN } from "@/constants";
import { formatHexString } from "@/utils/evm";
import { decodeCamelCase } from "@/utils/case";
import { InputText, TextArea } from "@aragon/ods";
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

// Group runs of identical children (same to + selector) for readable batches.
function groupChildren(children: DecodedNode[]): Array<{ node: DecodedNode; count: number }> {
  const out: Array<{ node: DecodedNode; count: number }> = [];
  for (const child of children) {
    const last = out[out.length - 1];
    if (last && last.node.to === child.to && last.node.selector === child.selector && child.children.length === 0) {
      last.count += 1;
    } else {
      out.push({ node: child, count: 1 });
    }
  }
  return out;
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
            const v = p.formatted ?? paramDisplay(p.value);
            const label = decodeCamelCase(p.name || `Parameter ${i + 1}`);
            return v.length > 42 ? (
              <TextArea key={i} label={label} className="h-full w-full" value={v} disabled />
            ) : (
              <InputText key={i} label={label} className="w-full" value={v} disabled />
            );
          })}
          {node.value > 0n && (
            <InputText
              label={`${PUB_CHAIN.nativeCurrency.symbol} value`}
              className="w-full"
              value={`${formatEther(node.value)} ${PUB_CHAIN.nativeCurrency.symbol}`}
              disabled
            />
          )}
        </div>
      )}

      {node.truncated && (
        <p className="text-sm text-warning-500">Nested calls hidden ({node.truncated}). View raw data on the explorer.</p>
      )}

      {/* Children */}
      {node.children.length > 0 && (
        <div className="flex flex-col gap-y-4">
          {groupChildren(node.children).map(({ node: child, count }, i) => (
            <div key={i} className="flex flex-col gap-y-1">
              {count > 1 && <span className="text-sm text-neutral-500">{count}× repeated call</span>}
              <ActionNode node={child} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
