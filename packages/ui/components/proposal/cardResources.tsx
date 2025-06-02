import getSecurityCouncilMemberData from "@/utils/getSecurityCouncilMemberData";
import { IGqlProposalMixin } from "@/utils/gql/getGqProposal";
import type { IProposalResource } from "@/utils/types";
import { Card, CardEmptyState, Heading, IconType, Link } from "@aragon/ods";
import React from "react";
import { Address } from "viem";

interface ICardResourcesProps {
  displayLink?: boolean;
  resources?: IProposalResource[];
  title: string;
  gqlProposal?: IGqlProposalMixin;
}

export const CardResources: React.FC<ICardResourcesProps> = (props) => {
  return (
    <div className="flex w-full flex-col gap-y-4">
      <DefaultDAOInfoCard {...props} />
      <CreationCard {...props} />
      <ApprovalsCard {...props} />
      <VetoCard {...props} />
      <ExecutionCard {...props} />
    </div>
  );
};

const CreationCard: React.FC<ICardResourcesProps> = (props) => {
  const { gqlProposal } = props;
  const resource = {
    url: "url",
    name: "name",
  };

  const creator = gqlProposal?.creator;
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
          Etherscan
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
