import { AvatarIcon, IconType, Tooltip } from "@aragon/ods";
import type { TrustLevel } from "@/utils/decoding/types";

// Icon-only by design: the label is verbose and repeats on every row, so it lives
// in a hover tooltip (and aria-label) instead of inline text. `variant` colors the
// icon; `tooltip` colors the tooltip to match the tier's severity.
const MAP: Record<
  TrustLevel,
  { label: string; variant: "primary" | "info" | "warning"; tooltip: "success" | "info" | "warning" | "critical"; icon: IconType }
> = {
  verified: { label: "Verified", variant: "primary", tooltip: "success", icon: IconType.CHECKMARK },
  // Bytecode-guessed ABI: real but unverified — visually distinct from the
  // "Verified" checkmark so voters don't read it as an endorsed source.
  bytecode: { label: "Decoded from bytecode", variant: "info", tooltip: "info", icon: IconType.BLOCKCHAIN_SMARTCONTRACT },
  "signature-db": { label: "Unverified signature", variant: "warning", tooltip: "warning", icon: IconType.WARNING },
  unknown: { label: "Could not decode", variant: "warning", tooltip: "critical", icon: IconType.WARNING },
};

export const TrustBadge: React.FC<{ trust: TrustLevel }> = ({ trust }) => {
  const { label, variant, tooltip, icon } = MAP[trust];
  return (
    <Tooltip content={label} variant={tooltip}>
      <span className="inline-flex items-center" role="img" aria-label={label}>
        <AvatarIcon variant={variant} size="sm" icon={icon} />
      </span>
    </Tooltip>
  );
};
