import { formatEther } from "viem";

export default function formatLargeNumber(value: bigint): [string, string] {
  const formattedValue = formatEther(value);
  const numValue = Math.floor(parseFloat(formattedValue));

  // First string: abbreviated format (1.3k, 2.5M, etc.)
  const getAbbreviatedFormat = (num: number): string => {
    const absNum = Math.abs(num);

    if (absNum >= 1e12) {
      return (num / 1e12).toFixed(1).replace(/\.0$/, "") + "T";
    } else if (absNum >= 1e9) {
      return (num / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    } else if (absNum >= 1e6) {
      return (num / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    } else if (absNum >= 1e3) {
      return (num / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
    } else {
      return num.toString();
    }
  };

  // Second string: prettified with commas (integers only)
  const getPrettifiedFormat = (num: number): string => {
    return num.toLocaleString("en-US");
  };

  const abbreviated = getAbbreviatedFormat(numValue);
  const prettified = getPrettifiedFormat(numValue);

  return [abbreviated, prettified];
}
