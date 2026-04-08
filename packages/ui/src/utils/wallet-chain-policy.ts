export function shouldForcePrimaryChainSwitch(
  currentChainId: number | undefined,
  primaryChainId: number,
  allowedSecondaryChainIds: number[] = []
) {
  if (!currentChainId) return false;
  if (currentChainId === primaryChainId) return false;

  return !allowedSecondaryChainIds.includes(currentChainId);
}
