import getSecurityCouncilMemberData from "@/utils/getSecurityCouncilMemberData";
import type { IProposalResource } from "@/utils/types";
import { Card, CardEmptyState, Heading, IconType, Link } from "@aragon/ods";
import React from "react";
import { zeroAddress } from "viem";
import SecurityCouncilProfiles from "@/data/security-council-profiles.json";
import { isAddressEqual } from "viem";
import { useEncryptionAccounts as useEncryptionAccountsEmergency } from "@/plugins/security-council/hooks/useEncryptionAccounts";
import { IGqlProposalMixin } from "@/utils/gql/types";

interface ICardResourcesProps {
  displayLink?: boolean;
  resources?: IProposalResource[];
  title: string;
  gqlProposal?: IGqlProposalMixin;
  relatedProposal?: IGqlProposalMixin;
}

export const CardResources: React.FC<ICardResourcesProps> = (props) => {
  return (
    <div className="flex w-full flex-col gap-y-4">
      <DefaultDAOInfoCard {...props} />
      <TransactionsCard {...props} />
    </div>
  );
};

const TransactionsCard: React.FC<ICardResourcesProps> = (props) => {
  const { gqlProposal, relatedProposal } = props;

  const creator = relatedProposal?.creator ?? gqlProposal?.creator ?? zeroAddress;

  const executor = relatedProposal?.executor ?? gqlProposal?.executor;

  const { data: encryptionAccounts } = useEncryptionAccountsEmergency();
  const owner =
    encryptionAccounts?.find(
      ({ appointedAgent }) => appointedAgent && creator && isAddressEqual(appointedAgent, creator)
    )?.owner ?? undefined;
  const executioner =
    encryptionAccounts?.find(
      ({ appointedAgent }) => appointedAgent && executor?.address && isAddressEqual(appointedAgent, executor.address)
    )?.owner ?? undefined;
  const creatorProfile = owner && SecurityCouncilProfiles.find((p: any) => isAddressEqual(p.address, owner));
  const executorProfile =
    executioner && SecurityCouncilProfiles.find((p: any) => isAddressEqual(p.address, executioner));

  const approvals = relatedProposal?.approvers ?? gqlProposal?.approvers ?? [];
  const vetoes = gqlProposal?.vetoes ?? relatedProposal?.vetoes ?? [];

  if (!props.gqlProposal || !props.gqlProposal.creationTxHash || !props.relatedProposal) {
    return null;
  }

  return (
    <Card className="flex flex-col gap-y-4 p-6 shadow-neutral">
      <Heading size="h4">Transactions</Heading>
      <table>
        <tbody>
          <tr>
            <td colSpan={2}>Creation</td>
          </tr>
          <tr>
            <td>
              <Link target="_blank" href={`https://etherscan.io/address/${relatedProposal.creator}`} variant="primary">
                {creatorProfile?.name}
              </Link>
            </td>
            <td>
              <Link
                target="_blank"
                href={`https://etherscan.io/tx/${relatedProposal.creationTxHash}`}
                variant="primary"
                iconRight={IconType.LINK_EXTERNAL}
              >
                tx
              </Link>
            </td>
          </tr>
          <tr>
            <td colSpan={2}>Approvals</td>
          </tr>
          {approvals.map((approver, i) => (
            <tr key={`approver-${i}`}>
              <td>
                <Link
                  target="_blank"
                  href={`https://etherscan.io/address/${approver.address}`}
                  variant="primary"
                  key={i}
                >
                  {getSecurityCouncilMemberData(approver.address).name ?? approver.address}
                </Link>
              </td>
              <td>
                <Link
                  target="_blank"
                  href={`https://etherscan.io/tx/${approver.txHash}`}
                  variant="primary"
                  iconRight={IconType.LINK_EXTERNAL}
                  key={i}
                >
                  tx
                </Link>
              </td>
            </tr>
          ))}
          {/* vetoes */}

          {vetoes.length > 0 && (
            <tr>
              <td colSpan={2}>Vetoes</td>
            </tr>
          )}

          {vetoes.map((vetoer, i) => (
            <tr key={`vetoer-${i}`}>
              {" "}
              <td>
                <Link target="_blank" href={`https://etherscan.io/address/${vetoer.address}`} variant="primary" key={i}>
                  {vetoer.address.replace(/^(.{6}).*(.{4})$/, "$1...$2")}
                </Link>
              </td>
              <td>
                <Link
                  target="_blank"
                  href={`https://etherscan.io/tx/${vetoer.txHash}`}
                  variant="primary"
                  iconRight={IconType.LINK_EXTERNAL}
                  key={i}
                >
                  tx
                </Link>
              </td>
            </tr>
          ))}

          {/* execution */}
          {!vetoes.length && (
            <tr>
              <td colSpan={2}>Execution</td>
            </tr>
          )}

          {!vetoes.length && (
            <tr>
              <td>
                <Link target="_blank" href={`https://etherscan.io/address/${executor?.address}`} variant="primary">
                  {executorProfile?.name}
                </Link>
              </td>
              <td>
                <Link
                  target="_blank"
                  href={`https://etherscan.io/tx/${executor?.txHash}`}
                  variant="primary"
                  iconRight={IconType.LINK_EXTERNAL}
                >
                  tx
                </Link>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
};
const DefaultDAOInfoCard: React.FC<ICardResourcesProps> = (props) => {
  const { displayLink = true, title } = props;
  let { resources } = props;

  if (resources == null || resources.length === 0) {
    return <CardEmptyState objectIllustration={{ object: "ARCHIVE" }} heading="No resources were added" />;
  }

  // Check that resources is not a empty but not an array
  if (!Array.isArray(resources)) resources = [resources];

  return (
    <Card className="flex flex-col gap-y-4 p-6 shadow-neutral">
      <Heading size="h3">{title}</Heading>
      <div className="flex flex-col gap-y-4">
        {resources?.map((resource) => (
          <Link
            target="_blank"
            key={resource.url}
            href={resource.url}
            variant="primary"
            iconRight={displayLink ? IconType.LINK_EXTERNAL : undefined}
            description={displayLink ? resource.url : undefined}
          >
            {resource.name}
          </Link>
        ))}
      </div>
    </Card>
  );
};
