import getSecurityCouncilMemberData from "@/utils/getSecurityCouncilMemberData";
import { IGqlProposalMixin } from "@/utils/gql/getGqProposal";
import type { IProposalResource } from "@/utils/types";
import { gql } from "@apollo/client";
import { Card, CardEmptyState, Heading, IconType, Link } from "@aragon/ods";
import React from "react";
import { Address, zeroAddress } from "viem";
import SecurityCouncilProfiles from "../../security-council-profiles.json";

import { OptimisticProposal } from "@/plugins/optimistic-proposals/utils/types";
import { useProposalStatus } from "@/plugins/optimistic-proposals/hooks/useProposalVariantStatus";
import { Else, ElseIf, If, Then } from "@/components/if";
import { getShortTimeDiffFrom } from "@/utils/dates";
import { HeaderSection } from "@/components/layout/header-section";
import { getTagVariantFromStatus } from "@/utils/ui-variants";
import { capitalizeFirstLetter } from "@/utils/text";
import { Publisher } from "@/components/publisher";
import { isAddressEqual } from "viem";
import { useEncryptionAccounts as useEncryptionAccountsEmergency } from "@/plugins/security-council/hooks/useEncryptionAccounts";

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
  if (!props.gqlProposal || !props.gqlProposal.creationTxHash || !props.relatedProposal) {
    return <Card className="flex flex-col gap-y-4 p-6 shadow-neutral">Loading tx info...</Card>;
  }
  const { gqlProposal, relatedProposal } = props;

  const creator = relatedProposal?.creator || gqlProposal?.creator || zeroAddress;

  const executor = relatedProposal?.executor || gqlProposal?.executor;

  const { data: encryptionAccounts } = useEncryptionAccountsEmergency();
  const owner =
    encryptionAccounts?.find(
      ({ appointedAgent }) => appointedAgent && creator && isAddressEqual(appointedAgent, creator)
    )?.owner || undefined;
  const executioner =
    encryptionAccounts?.find(
      ({ appointedAgent }) => appointedAgent && executor?.address && isAddressEqual(appointedAgent, executor.address)
    )?.owner || undefined;
  const creatorProfile = owner && SecurityCouncilProfiles.find((p: any) => isAddressEqual(p.address, owner));
  const executorProfile =
    executioner && SecurityCouncilProfiles.find((p: any) => isAddressEqual(p.address, executioner));

  const approvals = relatedProposal?.approvers || gqlProposal?.approvers || [];
  const vetoes = gqlProposal?.vetoes || relatedProposal?.vetoes || [];

  const hideExecutionTx =
    // if vetoed, no execution
    (vetoes.length && gqlProposal?.executor === null) ||
    // if std and still active, no execution
    (relatedProposal.isStandard && gqlProposal?.isOptimistic && gqlProposal?.executor === null);

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
            <tr>
              <td>
                <Link
                  target="_blank"
                  href={`https://etherscan.io/address/${approver.address}`}
                  variant="primary"
                  key={i}
                >
                  {getSecurityCouncilMemberData(approver.address).name || approver.address}
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
            <tr>
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
          {!hideExecutionTx && (
            <tr>
              <td colSpan={2}>Execution</td>
            </tr>
          )}

          {!hideExecutionTx && (
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
const CreationCard: React.FC<ICardResourcesProps> = (props) => {
  if (!props.gqlProposal || !props.gqlProposal.creationTxHash) {
    return null;
  }
  const { gqlProposal } = props;
  const creationTx = gqlProposal?.creationTxHash;

  return (
    <Card className="flex flex-col gap-y-4 p-6 shadow-neutral">
      <Heading size="h4">Creation Tx</Heading>
      <div className="flex flex-col gap-y-4">
        <Link
          target="_blank"
          href={`https://etherscan.io/tx/${creationTx}`}
          variant="primary"
          iconRight={IconType.LINK_EXTERNAL}
        >
          View on Etherscan
        </Link>
      </div>
    </Card>
  );
};

const ApprovalsCard: React.FC<ICardResourcesProps> = (props) => {
  const { gqlProposal } = props;
  if (!gqlProposal || !gqlProposal.approvers.length) {
    return null;
  }
  return (
    <Card className="flex flex-col gap-y-4 p-6 shadow-neutral">
      <Heading size="h4">Security Council Member Approvals</Heading>
      <div className="flex flex-col gap-y-4">
        {gqlProposal?.approvers.map((approver, i) => (
          <Link
            target="_blank"
            href={`https://etherscan.io/tx/${approver.txHash}`}
            variant="primary"
            iconRight={IconType.LINK_EXTERNAL}
            key={i}
          >
            {getSecurityCouncilMemberData(approver.address).name || approver.address}
          </Link>
        ))}
      </div>
    </Card>
  );
};

const VetoCard: React.FC<ICardResourcesProps> = (props) => {
  const { gqlProposal } = props;
  if (!gqlProposal || !gqlProposal.vetoes.length) {
    return null;
  }

  return (
    <Card className="flex flex-col gap-y-4 p-6 shadow-neutral">
      <Heading size="h4">Veto Votes</Heading>
      <div className="flex flex-col gap-y-4">
        {gqlProposal?.vetoes.map((approver, i) => (
          <Link
            target="_blank"
            href={`https://etherscan.io/tx/${approver.txHash}`}
            variant="primary"
            iconRight={IconType.LINK_EXTERNAL}
            key={i}
          >
            {getSecurityCouncilMemberData(approver.address).name || approver.address}
          </Link>
        ))}
      </div>
    </Card>
  );
};

const DefaultDAOInfoCard: React.FC<ICardResourcesProps> = (props) => {
  const { displayLink = true, title } = props;
  let { resources, gqlProposal } = props;

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

const ExecutionCard: React.FC<ICardResourcesProps> = (props) => {
  const { gqlProposal } = props;

  if (!gqlProposal || !gqlProposal.executor) {
    return null;
  }
  const executor = gqlProposal?.creator as Address;
  const executionTx = gqlProposal?.executor?.txHash;

  return (
    <Card className="flex flex-col gap-y-4 p-6 shadow-neutral">
      <Heading size="h4">Execution Tx</Heading>
      <div className="flex flex-col gap-y-4">
        <Link
          target="_blank"
          href={`https://etherscan.io/tx/${executionTx}`}
          variant="primary"
          iconRight={IconType.LINK_EXTERNAL}
        >
          Etherscan
        </Link>
      </div>
    </Card>
  );
};
