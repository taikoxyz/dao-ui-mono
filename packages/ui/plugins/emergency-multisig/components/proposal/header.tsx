import { AvatarIcon, Heading, IconType, ProposalStatus, TagVariant } from "@aragon/ods";
import { useProposalStatus } from "@/plugins/emergency-multisig/hooks/useProposalVariantStatus";
import { Publisher } from "@/components/publisher";
import { getShortTimeDiffFrom } from "@/utils/dates";
import { EmergencyProposal } from "../../utils/types";
import { Else, ElseIf, If, Then } from "@/components/if";
import { HeaderSection } from "@/components/layout/header-section";
import SecurityCouncilProfiles from "../../../../security-council-profiles.json";
import { useEncryptionAccounts } from "@/plugins/security-council/hooks/useEncryptionAccounts";
import { Address, isAddressEqual } from "viem";
import { useGqlProposalSingle } from "@/utils/gql/hooks/useGetGqlProposalSingle";

interface ProposalHeaderProps {
  proposalId: string;
  proposal: EmergencyProposal;
}

const ProposalHeader: React.FC<ProposalHeaderProps> = ({ proposalId, proposal }) => {
  const proposalStatus = useProposalStatus(proposal);
  const expired = Number(proposal.parameters.expirationDate) * 1000 <= Date.now();
  const { data: encryptionAccounts } = useEncryptionAccounts();

  const { data: gqlProposal } = useGqlProposalSingle({
    proposalId: proposalId,
    isStandard: false,
    isOptimistic: false,
    isEmergency: true,
  });

  const creator = gqlProposal?.creator as Address;
  const owner =
    encryptionAccounts?.find(
      ({ appointedAgent }) => creator && appointedAgent && isAddressEqual(appointedAgent, creator)
    )?.owner || undefined;
  const profile = owner && SecurityCouncilProfiles.find((p: any) => isAddressEqual(p.address, owner));

  console.log("header", { owner, gqlProposal });
  return (
    <div className="flex w-full justify-center bg-neutral-0">
      {/* Wrapper */}
      <HeaderSection>
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
            <Publisher
              gqlProposal={gqlProposal}
              publisher={[{ address: proposal.creator, name: profile?.name || "" }]}
            />
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
