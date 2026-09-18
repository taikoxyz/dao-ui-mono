import { ProposalStatus, TagVariant } from "@aragon/ods";

export function getTagVariantFromStatus(status: ProposalStatus | undefined): TagVariant {
  switch (status) {
    case ProposalStatus.ACCEPTED:
      return "success";
    case ProposalStatus.ACTIVE:
      return "info";
    case ProposalStatus.CHALLENGED:
      return "warning";
    case ProposalStatus.DRAFT:
      return "neutral";
    case ProposalStatus.EXECUTED:
      // Taiko pink — executed is the DAO's terminal success state and gets the
      // brand colour rather than the generic green used for "passing" states.
      // "primaryStrong" matches the weight of the other status variants.
      return "primaryStrong";
    case ProposalStatus.EXPIRED:
      return "critical";
    case ProposalStatus.FAILED:
      return "critical";
    case ProposalStatus.PARTIALLY_EXECUTED:
      return "warning";
    case ProposalStatus.PENDING:
      return "neutral";
    case ProposalStatus.REJECTED:
      return "critical";
    case ProposalStatus.VETOED:
      return "warning";
    default:
      return "neutral";
  }
}
