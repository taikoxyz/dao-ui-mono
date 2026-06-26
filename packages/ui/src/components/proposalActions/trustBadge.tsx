import { AvatarIcon, IconType } from "@aragon/ods";
import type { TrustLevel } from "@/utils/decoding/types";

const MAP: Record<TrustLevel, { label: string; variant: "primary" | "warning"; icon: IconType }> = {
  verified: { label: "Verified", variant: "primary", icon: IconType.CHECKMARK },
  bytecode: { label: "Decoded from bytecode", variant: "primary", icon: IconType.CHECKMARK },
  "signature-db": { label: "Unverified signature", variant: "warning", icon: IconType.WARNING },
  unknown: { label: "Could not decode", variant: "warning", icon: IconType.WARNING },
};

export const TrustBadge: React.FC<{ trust: TrustLevel }> = ({ trust }) => {
  const { label, variant, icon } = MAP[trust];
  return (
    <span className="flex items-center gap-x-1 text-neutral-500" title={label}>
      <AvatarIcon variant={variant} size="sm" icon={icon} />
      <span className="text-sm">{label}</span>
    </span>
  );
};
