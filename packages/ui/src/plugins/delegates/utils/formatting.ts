import { formatEther } from "viem";

export function formatTokenAmount(amount: bigint, decimals: number = 2): { formatted: string; full: string } {
  const fullAmount = formatEther(amount);
  const numberValue = parseFloat(fullAmount);

  if (isNaN(numberValue) || numberValue === 0) {
    return {
      formatted: "0",
      full: "0",
    };
  }

  let full = numberValue.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });

  if (full === "0" && amount > 0n) {
    full = fullAmount;
  }

  if (numberValue >= 1_000_000) {
    return {
      formatted: `${(numberValue / 1_000_000).toFixed(decimals)}M`,
      full,
    };
  } else if (numberValue >= 1_000) {
    return {
      formatted: `${(numberValue / 1_000).toFixed(decimals)}k`,
      full,
    };
  } else if (numberValue < Math.pow(10, -decimals)) {
    return {
      formatted: `<${Math.pow(10, -decimals).toFixed(decimals)}`,
      full,
    };
  } else {
    return {
      formatted: numberValue.toFixed(decimals),
      full,
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
