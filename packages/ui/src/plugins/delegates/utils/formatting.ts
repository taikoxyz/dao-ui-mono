import { formatEther } from "viem";

export function formatTokenAmount(amount: bigint): { formatted: string; full: string } {
  const fullAmount = formatEther(amount);
  const numberValue = parseFloat(fullAmount);

  if (numberValue >= 1_000_000) {
    return {
      formatted: `${(numberValue / 1_000_000).toFixed(1)}M`,
      full: Math.floor(numberValue).toLocaleString(),
    };
  } else if (numberValue >= 1_000) {
    return {
      formatted: `${(numberValue / 1_000).toFixed(1)}k`,
      full: Math.floor(numberValue).toLocaleString(),
    };
  } else {
    return {
      formatted: Math.floor(numberValue).toString(),
      full: Math.floor(numberValue).toLocaleString(),
    };
  }
}

export function formatPercentage(part: bigint, total: bigint): string {
  if (!total || total === 0n) return "0%";

  const percentage = (Number(part) / Number(total)) * 100;

  if (percentage < 1 && percentage > 0) {
    return "<1%";
  }

  return `${Math.round(percentage)}%`;
}
