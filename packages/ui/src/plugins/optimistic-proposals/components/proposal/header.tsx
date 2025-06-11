import { AvatarIcon, Breadcrumbs, Heading, IBreadcrumbsLink, IconType, ProposalStatus, Tag } from "@aragon/ods";
import { OptimisticProposal } from "@/plugins/optimistic-proposals/utils/types";
import { useProposalStatus } from "@/plugins/optimistic-proposals/hooks/useProposalVariantStatus";
import { Else, ElseIf, If, Then } from "@/components/if";
import { getShortTimeDiffFrom } from "@/utils/dates";
import { HeaderSection } from "@/components/layout/header-section";
import { getTagVariantFromStatus } from "@/utils/ui-variants";
import { capitalizeFirstLetter } from "@/utils/text";
import { Publisher } from "@/components/publisher";
import { Address, isAddressEqual } from "viem";
import { useEncryptionAccounts as useEncryptionAccountsEmergency } from "@/plugins/security-council/hooks/useEncryptionAccounts";
import SecurityCouncilProfiles from "@/data/security-council-profiles.json";
import { IGqlProposalMixin } from "@/utils/gql/getGqProposal";

const DEFAULT_PROPOSAL_TITLE = "(No proposal title)";
const DEFAULT_PROPOSAL_SUMMARY = "(No proposal summary)";

interface ProposalHeaderProps {
  proposalIdx: number;
  proposal: OptimisticProposal;
  gqlProposal?: IGqlProposalMixin | undefined;
}

const ProposalHeader: React.FC<ProposalHeaderProps> = ({ proposalIdx, proposal, gqlProposal }) => {
  const {
    status: proposalStatus,
    isEmergency,
    isPastEndDate,
    isL2GracePeriod,
    isTimelockPeriod,
    l2GracePeriodEnd,
    timelockPeriodEnd,
  } = useProposalStatus(proposal);
  const tagVariant = getTagVariantFromStatus(proposalStatus);

  const breadcrumbs: IBreadcrumbsLink[] = [{ label: "Proposals", href: "#/" }, { label: proposalIdx.toString() }];

  const { data: encryptionAccounts } = useEncryptionAccountsEmergency();
  const creator = gqlProposal?.creator as Address;
  const owner =
    encryptionAccounts?.find(
      ({ appointedAgent }) => appointedAgent && creator && isAddressEqual(appointedAgent, creator)
    )?.owner || undefined;
  const profile = owner && SecurityCouncilProfiles.find((p: any) => isAddressEqual(p.address, owner));

  return (
    <div className="flex w-full justify-center bg-neutral-0">
      {/* Wrapper */}
      <HeaderSection>
        <Breadcrumbs links={breadcrumbs} />
        {/* Title & description */}
        <div className="flex w-full flex-col gap-y-2">
          <div className="flex w-full items-center gap-x-4">
            <Heading size="h1">{proposal.title || DEFAULT_PROPOSAL_TITLE}</Heading>
            {proposalStatus && <Tag label={capitalizeFirstLetter(proposalStatus)} variant={tagVariant} />}
          </div>
          <div className="flex w-full items-center gap-x-4">
            {isEmergency && <Tag label="Emergency Proposal" variant="critical" />}
            {!isEmergency && <Tag label="Standard Proposal" variant="neutral" />}
          </div>
          <p className="text-lg leading-normal text-neutral-500">{proposal.summary || DEFAULT_PROPOSAL_SUMMARY}</p>
        </div>
        {/* Metadata */}
        <div className="flex flex-wrap gap-x-10 gap-y-2">
          <div className="flex items-center gap-x-2">
            <AvatarIcon icon={IconType.APP_MEMBERS} size="sm" variant="primary" />
            <Publisher
              gqlProposal={gqlProposal}
              publisher={[{ address: proposal.creator, name: profile?.name || "" }]}
            />
          </div>
          <div className="flex items-center gap-x-2">
            <AvatarIcon icon={IconType.APP_MEMBERS} size="sm" variant="primary" />
            <div className="flex gap-x-1 text-base leading-tight">
              <If condition={proposalStatus == ProposalStatus.VETOED}>
                <Then>
                  <span className="text-neutral-500">The proposal has been defeated</span>
                </Then>
                <ElseIf condition={isEmergency}>
                  <span className="text-neutral-500">The emergency proposal has been executed</span>
                </ElseIf>
                <ElseIf condition={proposalStatus == ProposalStatus.EXECUTED}>
                  <span className="text-neutral-500">The proposal has been executed</span>
                </ElseIf>
                <ElseIf condition={isTimelockPeriod}>
                  <span className="text-neutral-500">Accepted: in timelock for</span>
                  <span className="text-neutral-800">{getShortTimeDiffFrom(timelockPeriodEnd)}</span>
                </ElseIf>
                <ElseIf condition={isL2GracePeriod}>
                  <span className="text-neutral-500">Accepted: waiting L2 vetoes for</span>
                  <span className="text-neutral-800">{getShortTimeDiffFrom(l2GracePeriodEnd)}</span>
                </ElseIf>
                <ElseIf condition={isPastEndDate}>
                  <span className="text-neutral-500">The veto period is over</span>
                </ElseIf>
                <Else>
                  <span className="text-neutral-500">Active for </span>
                  <span className="text-neutral-800">
                    {getShortTimeDiffFrom(proposal.parameters.vetoEndDate * 1000n)}
                  </span>
                </Else>
              </If>
            </div>
          </div>
        </div>
      </HeaderSection>
    </div>
  );
};

export default ProposalHeader;
