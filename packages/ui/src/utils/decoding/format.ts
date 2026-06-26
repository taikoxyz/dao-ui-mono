/** Truncate a hex string (address / hash) to `0x1234…abcd`; short inputs are returned unchanged. */
export function shortHex(value: string): string {
  return value.startsWith("0x") && value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}
