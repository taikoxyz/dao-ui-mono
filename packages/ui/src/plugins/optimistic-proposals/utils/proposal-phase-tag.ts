import { ProposalStatus, IconType, type TagVariant } from "@aragon/ods";
import { getTagVariantFromStatus } from "@/utils/ui-variants";
import { capitalizeFirstLetter } from "@/utils/text";

export interface PhaseTagInput {
  status: ProposalStatus | undefined;
  isEmergency: boolean;
  isL2GracePeriod: boolean;
  isTimelockPeriod: boolean;
  /**
   * Whether the on-chain governance settings (timelock + L2 grace durations) have
   * resolved. Until they do, the phase windows cannot be computed and both
   * isL2GracePeriod and isTimelockPeriod are false — which must NOT be read as
   * "past the timelock".
   */
  governanceSettingsLoaded: boolean;
}

export interface PhaseTag {
  label: string;
  variant: TagVariant;
}

/**
 * Phase-aware status pill for optimistic (standard) proposals.
 *
 * The coarse ProposalStatus ("Active"/"Accepted") doesn't tell you whether a
 * proposal is still in the community veto vote or has passed and is just
 * waiting to be executed. useProposalStatus only ever yields four base states
 * (ACTIVE, VETOED, EXECUTED, ACCEPTED); the three sub-phases inside ACCEPTED
 * (L2 veto grace → timelock → executable) are exposed as booleans. This maps
 * that complete set onto an explicit label + colour so the current phase is
 * obvious at a glance, and is shared by the detail header and the list cards so
 * both stay consistent.
 */
export function getPhaseTag({
  status,
  isEmergency,
  isL2GracePeriod,
  isTimelockPeriod,
  governanceSettingsLoaded,
}: PhaseTagInput): PhaseTag {
  // Status is briefly undefined while useProposalStatus computes.
  if (!status) return { label: "Pending", variant: "neutral" };

  // Terminal states.
  if (status === ProposalStatus.VETOED) return { label: "Vetoed", variant: "critical" };
  if (status === ProposalStatus.EXECUTED) return { label: "Executed", variant: "success" };

  // Emergency (fast-tracked) proposals have no veto/timelock windows.
  if (isEmergency) {
    if (status === ProposalStatus.ACTIVE) return { label: "Active", variant: "info" };
    return { label: capitalizeFirstLetter(status), variant: getTagVariantFromStatus(status) };
  }

  // Standard proposal lifecycle.
  if (status === ProposalStatus.ACTIVE) return { label: "Voting", variant: "info" };
  if (status === ProposalStatus.ACCEPTED) {
    if (isL2GracePeriod) return { label: "Awaiting L2 vetoes", variant: "warning" };
    if (isTimelockPeriod) return { label: "In timelock", variant: "warning" };
    // Without the governance settings the timelock window is unknown, so claiming
    // the proposal is executable would assert something we cannot know. A
    // proposal genuinely in timelock would otherwise be labelled "Executable".
    if (!governanceSettingsLoaded) return { label: "Accepted", variant: "success" };
    // Past the timelock and not yet executed → ready to execute.
    return { label: "Executable", variant: "success" };
  }

  return { label: capitalizeFirstLetter(status), variant: getTagVariantFromStatus(status) };
}

/**
 * Icon that matches the phase tag, so a card's icon can never contradict its
 * pill (e.g. a green checkmark next to an amber "In timelock").
 */
export function getPhaseIcon(variant: TagVariant): { icon: IconType; className: string } {
  switch (variant) {
    case "critical":
      return { icon: IconType.CLOSE, className: "text-critical-600" };
    case "warning":
      return { icon: IconType.CLOCK, className: "text-warning-600" };
    case "success":
      return { icon: IconType.CHECKMARK, className: "text-success-600" };
    case "info":
      return { icon: IconType.CLOCK, className: "text-primary-600" };
    default:
      return { icon: IconType.CLOCK, className: "text-neutral-400" };
  }
}
