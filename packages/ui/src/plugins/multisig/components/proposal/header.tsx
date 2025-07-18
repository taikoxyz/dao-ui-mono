import { AvatarIcon, Heading, IconType, ProposalStatus, Tag } from "@aragon/ods";
import { MultisigProposal } from "@/plugins/multisig/utils/types";
import { useProposalStatus } from "@/plugins/multisig/hooks/useProposalVariantStatus";
import { HeaderSection } from "@/components/layout/header-section";
import { Publisher } from "@/components/publisher";
import { getShortTimeDiffFrom } from "@/utils/dates";
import { Else, ElseIf, If, Then } from "@/components/if";
import { useEncryptionAccounts } from "@/plugins/security-council/hooks/useEncryptionAccounts";
import { isAddressEqual, zeroAddress } from "viem";
import SecurityCouncilProfiles from "@/data/security-council-profiles.json";
import { useGqlProposalSingle } from "@/utils/gql/hooks/useGetGqlProposalSingle";

interface ProposalHeaderProps {
  proposalId: string;
  proposal: MultisigProposal;
}

const ProposalHeader: React.FC<ProposalHeaderProps> = ({ proposalId, proposal }) => {
  const proposalStatus = useProposalStatus(proposal);
  const expired = Number(proposal.parameters.expirationDate) * 1000 <= Date.now();
  const { data: encryptionAccounts } = useEncryptionAccounts();

  const { data: gqlProposal } = useGqlProposalSingle({
    proposalId: proposalId,
    isStandard: true,
    isOptimistic: false,
    isEmergency: false,
  });
  const creator = gqlProposal?.creator ?? zeroAddress;

  const owner =
    encryptionAccounts?.find(({ appointedAgent }) => isAddressEqual(appointedAgent, creator))?.owner ?? undefined;
  const profile = owner && SecurityCouncilProfiles.find((p: any) => isAddressEqual(p.address, owner));

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
            <Publisher
              gqlProposal={gqlProposal}
              publisher={[{ address: proposal.creator, name: profile?.name ?? "" }]}
            />
          </div>
          <If condition={proposalStatus !== ProposalStatus.EXECUTED && !expired}>
            <div className="flex items-center gap-x-2">
              <div className="flex gap-x-1 text-base leading-tight">
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
