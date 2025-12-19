import { PUB_CHAIN } from "@/constants";
import { decodeCamelCase } from "@/utils/case";
import { IconType, Link, Tooltip } from "@aragon/ods";
import { formatEther, isAddress, type AbiParameter } from "viem";
import type { CallParameterFieldType } from "@/utils/abi-helpers";

interface ParamDisplayProps {
  value: CallParameterFieldType;
  abiParam?: AbiParameter;
  label: string;
}

// Format large numbers with thousand separators
function formatNumber(value: string | number | bigint): string {
  try {
    const num = BigInt(value);
    return num.toLocaleString("en-US");
  } catch {
    return String(value);
  }
}

// Format wei values as ETH
function formatWeiAsEth(value: bigint): string {
  const ethValue = formatEther(value);
  const num = parseFloat(ethValue);
  if (num === 0) return "0";
  if (num < 0.0001) return `${ethValue} ETH (≈ ${formatNumber(value)} wei)`;
  return `${num.toLocaleString("en-US", { maximumFractionDigits: 6 })} ETH`;
}

// Truncate address for display
function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Address display with link
const AddressDisplay: React.FC<{ address: string }> = ({ address }) => {
  const explorerUrl = `${PUB_CHAIN.blockExplorers?.default.url}/address/${address}`;

  return (
    <Tooltip content={address}>
      <Link
        href={explorerUrl}
        target="_blank"
        variant="primary"
        iconRight={IconType.LINK_EXTERNAL}
        className="font-mono text-sm"
      >
        {truncateAddress(address)}
      </Link>
    </Tooltip>
  );
};

// Resolve value for display based on type
function resolveDisplayValue(
  value: CallParameterFieldType,
  abiParam?: AbiParameter
): { type: "address" | "amount" | "text"; content: React.ReactNode } {
  const abiType = abiParam?.type;

  // Handle null/undefined values
  if (value === null || value === undefined) {
    return {
      type: "text",
      content: "(empty)",
    };
  }

  // Handle address type
  if (abiType === "address" && typeof value === "string" && isAddress(value)) {
    return {
      type: "address",
      content: <AddressDisplay address={value} />,
    };
  }

  // Handle uint/int types (potential wei values)
  if (abiType && (abiType.startsWith("uint") || abiType.startsWith("int"))) {
    try {
      const bigValue = BigInt(value as string | number | bigint);
      // Check if it looks like a wei value (more than 15 digits)
      if (bigValue > BigInt(1e15)) {
        return {
          type: "amount",
          content: formatWeiAsEth(bigValue),
        };
      }
      return {
        type: "text",
        content: formatNumber(bigValue),
      };
    } catch {
      // If BigInt conversion fails, fall back to string
      return {
        type: "text",
        content: String(value),
      };
    }
  }

  // Handle arrays
  if (Array.isArray(value)) {
    const items = value.map((item, idx) => {
      if (typeof item === "string" && isAddress(item)) {
        return (
          <span key={idx} className="block">
            <AddressDisplay address={item} />
          </span>
        );
      }
      return (
        <span key={idx} className="block">
          {String(item)}
        </span>
      );
    });
    return {
      type: "text",
      content: <div className="flex flex-col gap-1">{items}</div>,
    };
  }

  // Handle tuples/objects
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).map(([key, val]) => {
      const displayVal =
        typeof val === "string" && isAddress(val) ? (
          <AddressDisplay address={val} />
        ) : (
          String(val)
        );
      return (
        <div key={key} className="flex gap-2">
          <span className="font-medium text-neutral-600">{key}:</span>
          <span>{displayVal}</span>
        </div>
      );
    });
    return {
      type: "text",
      content: <div className="flex flex-col gap-1 rounded bg-neutral-50 p-2">{entries}</div>,
    };
  }

  // Handle booleans
  if (typeof value === "boolean") {
    return {
      type: "text",
      content: value ? "Yes" : "No",
    };
  }

  // Default string/hex display
  return {
    type: "text",
    content: String(value),
  };
}

export const ParamDisplay: React.FC<ParamDisplayProps> = ({ value, abiParam, label }) => {
  const { content } = resolveDisplayValue(value, abiParam);
  const displayLabel = decodeCamelCase(label);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-neutral-500">{displayLabel}</label>
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
        {content}
      </div>
    </div>
  );
};
