import { AvatarIcon, Breadcrumbs, Heading, IBreadcrumbsLink, IconType, ProposalStatus, Tag, TagVariant } from "@aragon/ods";
import { MultisigProposal } from "@/plugins/multisig/utils/types";
import { useProposalStatus } from "@/plugins/multisig/hooks/useProposalVariantStatus";
import { HeaderSection } from "@/components/layout/header-section";
import { Publisher } from "@/components/publisher";
import { getShortTimeDiffFrom } from "@/utils/dates";
import { Else, ElseIf, If, Then } from "@/components/if";
import { getTagVariantFromStatus } from "@/utils/ui-variants";
import { capitalizeFirstLetter } from "@/utils/text";

interface ProposalHeaderProps {
  proposalId: string;
  proposal: MultisigProposal;
}

const ProposalHeader: React.FC<ProposalHeaderProps> = ({ proposalId, proposal }) => {
  const proposalStatus = useProposalStatus(proposal);
  const tagVariant = getTagVariantFromStatus(proposalStatus);
  const breadcrumbs: IBreadcrumbsLink[] = [{ label: "Proposals", href: "#/" }, { label: proposalId.toString() }];
  const expired = Number(proposal.parameters.expirationDate) * 1000 <= Date.now();

  return (
    <div className="flex w-full justify-center bg-neutral-0">
      {/* Wrapper */}
      <HeaderSection>
        {/* Title & description */}
        <div className="flex w-full flex-col gap-y-2">
          <div className="flex w-full items-center gap-x-4">
            <Heading size="h1">{proposal.title}</Heading>
            {/* && <Tag label="Emergency" variant="critical" />*/}
            <If condition={proposalStatus == ProposalStatus.EXECUTED}>
                <Then>
                <Tag label="Sent to Community Stage" variant="success" />
                </Then>
                <ElseIf condition={expired}>
                <Tag label="Expired" variant="critical" />
                </ElseIf>
                <Else>
                <Tag label="Active" variant="info" />

                  </Else>

              </If>
          </div>
          <p className="text-lg leading-normal text-neutral-500">{proposal.summary}</p>
        </div>
        {/* Metadata */}
        <div className="flex flex-wrap gap-x-10 gap-y-2">
          <div className="flex items-center gap-x-2">
            <AvatarIcon icon={IconType.APP_MEMBERS} size="sm" variant="primary" />
            <Publisher publisher={[{ address: proposal.creator }]} />
          </div>
          <If condition={proposalStatus !== ProposalStatus.EXECUTED && !expired}>
          <div className="flex items-center gap-x-2">
            <div className="flex gap-x-1 text-base leading-tight ">

                  <span className="text-neutral-800">
                    {getShortTimeDiffFrom(proposal.parameters.expirationDate * 1000n)}
                  </span>
                  <span className="text-neutral-500">left until expiration</span>
            </div>
          </div>
            </If>

        </div>
      </HeaderSection>
    </div>
  );
};

export default ProposalHeader;
