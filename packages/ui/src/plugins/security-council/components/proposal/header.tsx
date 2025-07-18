import { AvatarIcon, Breadcrumbs, Heading, IBreadcrumbsLink, IconType, ProposalStatus } from "@aragon/ods";
import { useProposalStatus } from "@/plugins/emergency-multisig/hooks/useProposalVariantStatus";
import { Publisher } from "@/components/publisher";
import { getShortTimeDiffFrom } from "@/utils/dates";
import { Else, ElseIf, If, Then } from "@/components/if";
import { HeaderSection } from "@/components/layout/header-section";
import { getTagVariantFromStatus } from "@/utils/ui-variants";
import { capitalizeFirstLetter } from "@/utils/text";
import { EmergencyProposal } from "@/plugins/emergency-multisig/utils/types";

interface ProposalHeaderProps {
  proposalId: string;
  proposal: EmergencyProposal;
}

const ProposalHeader: React.FC<ProposalHeaderProps> = ({ proposalId, proposal }) => {
  const proposalStatus = useProposalStatus(proposal);
  const tagVariant = getTagVariantFromStatus(proposalStatus);
  const breadcrumbs: IBreadcrumbsLink[] = [{ label: "Proposals", href: "#/" }, { label: proposalId }];
  const expired = Number(proposal.parameters.expirationDate) * 1000 <= Date.now();
  return (
    <div className="flex w-full justify-center bg-neutral-0">
      {/* Wrapper */}
      <HeaderSection>
        <Breadcrumbs
          links={breadcrumbs}
          tag={
            proposalStatus && {
              label: capitalizeFirstLetter(proposalStatus),
              variant: tagVariant,
            }
          }
        />
        {/* Title & description */}
        <div className="flex w-full flex-col gap-y-2">
          <div className="flex w-full items-center gap-x-4">
            <Heading size="h1">{proposal.title}</Heading>
            {/* && <Tag label="Emergency" variant="critical" />*/}
          </div>
          <p className="text-lg leading-normal text-neutral-500">{proposal.summary}</p>
        </div>
        {/* Metadata */}
        <div className="flex flex-wrap gap-x-10 gap-y-2">
          <div className="flex items-center gap-x-2">
            <AvatarIcon icon={IconType.APP_MEMBERS} size="sm" variant="primary" />
            <Publisher publisher={[{ address: proposal.creator }]} />
          </div>
          <div className="flex items-center gap-x-2">
            <AvatarIcon icon={IconType.APP_MEMBERS} size="sm" variant="primary" />
            <div className="flex gap-x-1 text-base leading-tight">
              <If condition={proposalStatus == ProposalStatus.EXECUTED}>
                <Then>
                  <span className="text-neutral-500">The proposal was sent to the community stage</span>
                </Then>
                <ElseIf condition={expired}>
                  <span className="text-neutral-500">The proposal expired</span>
                </ElseIf>
                <Else>
                  <span className="text-neutral-800">
                    {getShortTimeDiffFrom(proposal.parameters.expirationDate * 1000n)}
                  </span>
                  <span className="text-neutral-500">left until expiration</span>
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
