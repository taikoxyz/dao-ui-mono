import { PUB_CHAIN } from "@/constants";
import { formatHexString } from "@/utils/evm";
import Link from "next/link";
import { formatEther } from "viem";
import type { DecodedNode, DecodedParam } from "@/utils/decoding/types";
import { shortHex } from "@/utils/decoding/format";
import { childNumber, friendlySignature, leadParts, contractLabel, chainLabel } from "./actionNode.helpers";
import { EncodedView } from "./encodedView";
import { TrustBadge } from "./trustBadge";
import { CopyButton } from "@/components/copy/copyButton";

// ---------- small pieces ----------

const AddrLink: React.FC<{ address: string; label?: string | null }> = ({ address, label }) => (
  <span className="inline-flex items-center gap-x-1">
    {label && <span className="font-semibold text-neutral-700">{label}</span>}
    <Link
      href={`${PUB_CHAIN.blockExplorers?.default.url}/address/${address}`}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      className="font-mono text-neutral-500 hover:underline"
    >
      {formatHexString(address)}
    </Link>
    <CopyButton value={address} />
  </span>
);

/** A decoded value rendered to a string (bigint-safe; arrays/objects flattened). */
function valueText(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(valueText).join(", ");
  if (value && typeof value === "object")
    return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return String(value);
}

const TYPE_CHIP = "rounded-md bg-primary-50 px-1.5 font-mono text-[10.5px] text-primary-700";

/** One parameter row: name + type chip → value (address links; tuples recurse; bytes-that-became-children noted). */
const ParamItem: React.FC<{ p: DecodedParam; childrenDecoded: boolean }> = ({ p, childrenDecoded }) => {
  const isBytesExpanded = p.type === "bytes" && childrenDecoded;

  const nameChip = (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="font-semibold text-neutral-700">{p.name || "(unnamed)"}</span>
      <span className={TYPE_CHIP}>{p.type}</span>
    </span>
  );

  // Tuple/struct: render the label on its own line with the fields indented
  // beneath it, instead of squeezing them into the value column (which left a
  // wide empty gap under the struct name).
  if (p.components && p.components.length > 0) {
    return (
      <div className="py-1">
        {nameChip}
        <div className="mt-1 flex flex-col gap-y-1 border-l-2 border-neutral-100 pl-3">
          {p.components.map((c, i) => (
            <ParamItem key={i} p={c} childrenDecoded={childrenDecoded} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(120px,200px)_1fr] items-start gap-x-3 gap-y-1 py-1">
      {nameChip}
      {isBytesExpanded ? (
        <span className="text-sm italic text-primary-600">↓ decoded as the action(s) below</span>
      ) : p.type === "address" ? (
        <AddrLink address={String(p.value)} />
      ) : (
        <span className="flex min-w-0 items-start gap-x-1">
          <span className="break-all font-mono text-xs text-neutral-700">{p.formatted ?? valueText(p.value)}</span>
          {String(p.value).length > 18 && <CopyButton value={String(p.value)} />}
        </span>
      )}
    </div>
  );
};

/** The full-width Inputs panel: signature (friendly + full toggle), typed params, embedded calls, value, raw calldata. */
const InputsPanel: React.FC<{ node: DecodedNode }> = ({ node }) => {
  if (node.error || (!node.functionName && !node.summary)) {
    return <EncodedView rawAction={{ to: node.to, value: node.value, data: node.data }} />;
  }
  const sig = friendlySignature(node);
  const hasChildren = node.children.length > 0;
  const symbol = PUB_CHAIN.nativeCurrency.symbol;
  // Any decode that did not come from a verified ABI source (bytecode guess,
  // community signature DB, or unknown) gets the same amber caveat panel, so the
  // body matches the headline's "Unverified:" prefix and the trust badge. Only a
  // verified source renders neutral.
  const unverified = node.trust !== "verified";

  return (
    <div className={`rounded-lg border px-3 py-3 ${unverified ? "border-warning-200 bg-warning-50" : "border-neutral-100 bg-neutral-50"}`}>
      {unverified && (
        <p className="mb-2 text-xs text-warning-800">⚠ Decoded without a verified source — verify against raw calldata.</p>
      )}
      {sig.short && (
        <details className="mb-2">
          <summary className="cursor-pointer list-none font-mono text-xs text-neutral-600">
            {sig.short}
            {sig.full && sig.full !== sig.short && <span className="ml-2 font-sans font-semibold text-primary-500">▸ full signature</span>}
          </summary>
          {sig.full && sig.full !== sig.short && (
            <pre className="mt-2 whitespace-pre-wrap break-all rounded-md border border-neutral-100 bg-neutral-0 p-2 font-mono text-[11px] text-neutral-500">
              {sig.full}
            </pre>
          )}
        </details>
      )}
      {node.params.length > 0 ? (
        node.params.map((p, i) => <ParamItem key={i} p={p} childrenDecoded={hasChildren} />)
      ) : (
        <p className="text-sm text-neutral-500">No input parameters.</p>
      )}
      {node.embeddedCalls && node.embeddedCalls.length > 0 && (
        <div className="mt-2 flex flex-col gap-y-1 rounded-md border border-warning-200 bg-warning-50 px-3 py-2">
          <span className="text-xs font-semibold text-warning-800">Encoded call(s) detected — Unverified</span>
          {node.embeddedCalls.map((e, i) => (
            <div key={i} className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-700">
              <span className="font-mono text-neutral-500">{e.path}</span>
              <span>→</span>
              <span className="font-medium">{e.signature ?? "unknown function"}</span>
              <span className="font-mono text-neutral-500">{shortHex(e.selector)}</span>
            </div>
          ))}
        </div>
      )}
      {node.value > 0n && (
        <p className="mt-2 text-sm text-neutral-600">
          {symbol} value: {formatEther(node.value)} {symbol}
        </p>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer list-none text-xs text-neutral-500">▸ Raw calldata</summary>
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-neutral-0 p-2 text-[11px] text-neutral-700">
          {node.data}
        </pre>
      </details>
    </div>
  );
};

/** Title line for a row: the recognized summary, else the humanized function name, else a fallback. */
function rowTitle(node: DecodedNode): string {
  const lead = leadParts(node);
  return lead.text;
}

/** One numbered accordion action row; expands the Inputs panel and recurses into children. */
const ActionRow: React.FC<{ node: DecodedNode; number: string }> = ({ node, number }) => {
  const label = contractLabel(node);
  const chain = chainLabel(node.chainId);
  const isChild = number.includes(".");
  // No left border here: the parent's children container (below) draws the single
  // nesting guide line for the whole group. Adding one per row too doubled it.
  return (
    <div>
      <details className="group border-t border-neutral-100 first:border-t-0">
        <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-start gap-x-3 rounded-lg px-1 py-3 hover:bg-neutral-50">
          <span
            className={`flex h-6 min-w-[30px] items-center justify-center rounded-md px-1.5 font-mono text-xs font-bold ${
              isChild ? "bg-primary-50 text-primary-700" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {number}
          </span>
          <span className="min-w-0">
            <span className="font-semibold leading-tight text-neutral-800">{rowTitle(node)}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
              on <AddrLink address={node.to} label={label} />
              {node.functionName && (
                <span className="rounded-md bg-neutral-100 px-1.5 font-mono text-[11px] text-neutral-500">{node.functionName}</span>
              )}
            </span>
            <span className="mt-1.5 inline-flex items-center gap-x-1 text-sm font-semibold text-primary-500">
              <span className="inline-block text-[11px] transition-transform group-open:rotate-90">▸</span> Inputs
            </span>
          </span>
          <span className="flex shrink-0 flex-wrap justify-end gap-1 pt-0.5">
            <TrustBadge trust={node.trust} />
            {chain && (
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">↗ {chain}</span>
            )}
          </span>
        </summary>
        <div className="mb-3 ml-[42px]">
          <InputsPanel node={node} />
        </div>
      </details>
      {node.children.length > 0 && (
        <div className="ml-3 border-l-2 border-l-primary-100 pl-3">
          {node.children.map((c, i) => (
            <ActionRow key={i} node={c} number={childNumber(number, i)} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Body of a top-level proposal action. A wrapper (e.g. execute-batch) shows a
 * batch header + its numbered child rows; a leaf shows its own inputs.
 */
export const ActionNodeBody: React.FC<{ node: DecodedNode }> = ({ node }) => {
  if (node.children.length > 0) {
    const label = contractLabel(node);
    return (
      <div className="flex flex-col">
        {/* No trust badge here: the top-level Action header already shows the
            batch's worst-case trust, and every child row carries its own. */}
        <p className="px-1 pb-2 text-xs text-neutral-500">
          Executes a batch of {node.children.length} via{" "}
          {label && <span className="font-semibold text-neutral-700">{label} </span>}
          <span className="font-mono">{formatHexString(node.to)}</span>
        </p>
        {node.children.map((c, i) => (
          <ActionRow key={i} node={c} number={childNumber("", i)} />
        ))}
      </div>
    );
  }
  // Single leaf action: the accordion header already shows its title + contract,
  // so the body is just the typed inputs (no duplicate title line).
  return <InputsPanel node={node} />;
};
