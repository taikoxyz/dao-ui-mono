import { PUB_CHAIN } from "@/constants";
import { capitalizeFirstLetter } from "@/utils/text";
import { formatHexString } from "@/utils/evm";
import { type RawAction } from "@/utils/types";
import { InputText, NumberFormat, formatterUtils, Link, IconType } from "@aragon/ods";
import { formatEther, decodeAbiParameters, type Hex, decodeFunctionData } from "viem";
import { getFallbackAbiFunction } from "@/utils/fallback-abi";

type IEncodedViewProps = {
  rawAction: RawAction;
};

// Try to decode nested actions from calldata
function tryDecodeNestedActions(data: Hex): RawAction[] | null {
  if (!data || data === "0x" || data.length < 10) return null;

  // Check if it starts with zeros (typical for ABI-encoded array)
  if (data.startsWith("0x000000000000000000000000000000000000000000000000000000000000")) {
    try {
      const actionsType = [
        {
          type: "tuple[]",
          components: [
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "data", type: "bytes" },
          ],
        },
      ] as const;
      const decoded = decodeAbiParameters(actionsType, data);
      if (decoded && decoded[0] && decoded[0].length > 0) {
        return decoded[0].map((action) => ({
          to: action.to,
          value: action.value,
          data: action.data as Hex,
        }));
      }
    } catch {
      // Not a valid actions array
    }
  }
  return null;
}

// Try to decode function call using fallback ABI
function tryDecodeFunctionCall(data: Hex): { name: string; args: readonly unknown[] } | null {
  if (!data || data === "0x" || data.length < 10) return null;

  const selector = data.slice(0, 10) as Hex;
  const fallbackFunc = getFallbackAbiFunction(selector);

  if (fallbackFunc) {
    try {
      const decoded = decodeFunctionData({
        abi: [fallbackFunc],
        data,
      });
      return { name: decoded.functionName, args: decoded.args ?? [] };
    } catch {
      // Decoding failed
    }
  }
  return null;
}

// Format a decoded argument for display
function formatArg(arg: unknown): string {
  if (typeof arg === "bigint") {
    return arg.toString();
  }
  if (typeof arg === "string") {
    return arg;
  }
  if (typeof arg === "boolean") {
    return arg ? "true" : "false";
  }
  if (Array.isArray(arg)) {
    return `[${arg.length} items]`;
  }
  if (typeof arg === "object" && arg !== null) {
    return JSON.stringify(arg);
  }
  return String(arg);
}

export const EncodedView: React.FC<IEncodedViewProps> = (props) => {
  const { rawAction } = props;

  // Try to decode nested actions first
  const nestedActions = tryDecodeNestedActions(rawAction.data as Hex);
  if (nestedActions && nestedActions.length > 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">
          This action contains {nestedActions.length} nested action{nestedActions.length > 1 ? "s" : ""}:
        </p>
        {nestedActions.map((action, idx) => (
          <NestedActionView key={idx} action={action} index={idx} />
        ))}
      </div>
    );
  }

  return getEncodedArgs(rawAction).map((arg) => (
    <InputText key={arg.title} label={arg.title} disabled={true} value={arg.value} className="w-full" />
  ));
};

// Component to display a nested action
const NestedActionView: React.FC<{ action: RawAction; index: number }> = ({ action, index }) => {
  const explorerUrl = `${PUB_CHAIN.blockExplorers?.default.url}/address/${action.to}`;
  const decoded = tryDecodeFunctionCall(action.data as Hex);

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-700">Action {index + 1}</span>
        {decoded && (
          <span className="rounded bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
            {decoded.name}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">To:</span>
          <Link href={explorerUrl} target="_blank" variant="primary" iconRight={IconType.LINK_EXTERNAL}>
            {formatHexString(action.to)}
          </Link>
        </div>
        {action.value > BigInt(0) && (
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Value:</span>
            <span>{formatEther(action.value)} {PUB_CHAIN.nativeCurrency.symbol}</span>
          </div>
        )}
        {decoded ? (
          <div className="flex flex-col gap-1">
            <span className="text-neutral-500">Parameters:</span>
            {decoded.args.map((arg, i) => (
              <div key={i} className="ml-2 flex items-center gap-2 font-mono text-xs">
                <span className="text-neutral-400">[{i}]:</span>
                <span className="break-all">{formatArg(arg)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-neutral-500">Data:</span>
            <span className="break-all font-mono text-xs text-neutral-600">{action.data}</span>
          </div>
        )}
      </div>
    </div>
  );
};

function getEncodedArgs(action: RawAction) {
  const isEthTransfer = !action.data || action.data === "0x";

  if (isEthTransfer) {
    return [
      { title: "To", value: action.to },
      {
        title: "Value",
        value: `${formatterUtils.formatNumber(formatEther(action.value, "wei"), { format: NumberFormat.TOKEN_AMOUNT_SHORT })} ${PUB_CHAIN.nativeCurrency.symbol}`,
      },
    ];
  }

  // Force the value to appear last
  const v = action.value;
  delete (action as any).value;
  action.value = v;

  return Object.entries(action).map(([key, value]) => {
    if (key === "value") {
      return {
        title: capitalizeFirstLetter(key),
        value: formatEther(value as bigint, "wei") + " " + PUB_CHAIN.nativeCurrency.symbol,
      };
    }
    return { title: capitalizeFirstLetter(key), value: value.toString() };
  });
}
