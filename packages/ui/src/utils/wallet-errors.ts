export const CONNECT_WALLET_EXECUTE_ALERT_MESSAGE = "Connect wallet to execute proposal";
export const CONNECT_WALLET_EXECUTE_ALERT_DESCRIPTION = "Your wallet is not connected. Connect it and try again.";

const WALLET_DISCONNECTED_PATTERNS = [
  "not connected",
  "account not found",
  "account is required",
  "no account",
  "cannot find account",
];

export function isWalletDisconnectedError(error?: { message?: string } | null): boolean {
  const msg = error?.message?.toLowerCase();
  if (!msg) return false;

  return WALLET_DISCONNECTED_PATTERNS.some((pattern) => msg.includes(pattern));
}
