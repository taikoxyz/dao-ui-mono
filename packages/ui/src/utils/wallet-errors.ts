type ErrorWithMessage = {
  message?: string;
};

export const CONNECT_WALLET_EXECUTE_ALERT_MESSAGE = "Connect wallet to execute proposal";
export const CONNECT_WALLET_EXECUTE_ALERT_DESCRIPTION = "Your wallet is not connected. Connect it and try again.";

const WALLET_DISCONNECTED_PATTERNS = [
  "connector not connected",
  "wallet is not connected",
  "account not found",
  "account is required",
  "no account",
  "no connector connected",
  "cannot find account",
  "not connected",
];

export function isWalletDisconnectedError(error?: ErrorWithMessage | null): boolean {
  const normalizedMessage = error?.message?.toLowerCase();
  if (!normalizedMessage) return false;

  return WALLET_DISCONNECTED_PATTERNS.some((pattern) => normalizedMessage.includes(pattern));
}
