import { useAccount, useBlockNumber, useReadContract } from "wagmi";
import { useEffect, useState } from "react";
import ProposalCard from "@/plugins/optimistic-proposals/components/proposal";
import {
  AlertCard,
  Button,
  CardEmptyState,
  DataList,
  Heading,
  IconType,
  Link,
  ProposalDataListItemSkeleton,
  Toggle,
  ToggleGroup,
  type DataListState,
} from "@aragon/ods";

import { Else, ElseIf, If, Then } from "@/components/if";
import {
  PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
  PUB_CHAIN,
  PUB_TOKEN_SYMBOL,
  PUB_APP_NAME,
  PUB_PROJECT_URL,
  PUB_MULTISIG_PLUGIN_ADDRESS,
} from "@/constants";
import { OptimisticTokenVotingPluginAbi } from "../artifacts/OptimisticTokenVotingPlugin.sol";
import { MainSection } from "@/components/layout/main-section";
import { ADDRESS_ZERO } from "@/utils/evm";
import { useTokenVotes } from "@/hooks/useTokenVotes";
import { AddressText } from "@/components/text/address";
import { Address } from "viem";
import { useGovernanceSettings } from "../hooks/useGovernanceSettings";
const DEFAULT_PAGE_SIZE = 6;

export function PublicProposals() {
  const { address } = useAccount();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const { balance, delegatesTo } = useTokenVotes(address);

  const {
    data: proposalCountResponse,
    error: isError,
    isLoading,
    isFetching: isFetchingNextPage,
    refetch,
  } = useReadContract({
    address: PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
    abi: OptimisticTokenVotingPluginAbi,
    functionName: "proposalCount",
    chainId: PUB_CHAIN.id,
  });
  const proposalCount = Number(proposalCountResponse);

  useEffect(() => {
    refetch();
  }, [blockNumber]);

  const entityLabel = proposalCount === 1 ? "Proposal" : "Proposals";

  let dataListState: DataListState = "idle";
  if (isLoading && !proposalCount) {
    dataListState = "initialLoading";
  } else if (isError) {
    dataListState = "error";
  } else if (isFetchingNextPage) {
    dataListState = "fetchingNextPage";
  }
  const hasBalance = balance !== undefined && balance > BigInt(0);
  const delegatingToSomeoneElse = !!delegatesTo && delegatesTo !== address && delegatesTo !== ADDRESS_ZERO;
  const delegatedToZero = !!delegatesTo && delegatesTo === ADDRESS_ZERO;

  return (
    <>
      <If condition={hasBalance && (delegatingToSomeoneElse || delegatedToZero)}>
        <NoVetoPowerWarning
          delegatingToSomeoneElse={delegatingToSomeoneElse}
          delegatesTo={delegatesTo}
          delegatedToZero={delegatedToZero}
          address={address}
        />
      </If>
      <If condition={proposalCount}>
        <Then>
          <DataList.Root
            entityLabel={entityLabel}
            itemsCount={proposalCount}
            pageSize={DEFAULT_PAGE_SIZE}
            state={dataListState}
            onLoadMore={() => {
              console.log("load more");
            }}
          >
            <DataList.Container SkeletonElement={ProposalDataListItemSkeleton}>
              {Array.from(Array(proposalCount || 0)?.keys())
                .reverse()
                ?.map((proposalIndex) => <ProposalCard key={proposalIndex} proposalIndex={proposalIndex} />)}
            </DataList.Container>
            <DataList.Pagination />
          </DataList.Root>
        </Then>
        <Else>
          <CardEmptyState
            heading="No proposals yet"
            description="The list of proposals is currently empty. Here you will see the proposals created by the Security Council and submitted to the community for optimistic approval."
            objectIllustration={{
              object: "LABELS",
            }}
          />
        </Else>
      </If>
    </>
  );
}

const NoVetoPowerWarning = ({
  delegatingToSomeoneElse,
  delegatesTo,
  delegatedToZero,
  address,
}: {
  delegatingToSomeoneElse: boolean;
  delegatesTo: Address | undefined;
  delegatedToZero: boolean;
  address: Address | undefined;
}) => {
  return (
    <AlertCard
      description={
        <span className="text-sm">
          <If condition={delegatingToSomeoneElse}>
            <Then>
              You are currently delegating your voting power to <AddressText bold={false}>{delegatesTo}</AddressText>.
              If you wish to participate by yourself in future proposals,
            </Then>
            <ElseIf condition={delegatedToZero}>
              You have not self delegated your voting power to participate in the DAO. If you wish to participate in
              future proposals,
            </ElseIf>
          </If>
          &nbsp;make sure that{" "}
          <Link
            href={"/plugins/security-council/#/delegates/" + address}
            className="!text-sm text-primary-400 hover:underline"
          >
            your voting power is self delegated
          </Link>
          .
        </span>
      }
      message={
        delegatingToSomeoneElse ? "Your voting power is currently delegated" : "You cannot veto on new proposals"
      }
      variant="info"
    />
  );
};

export default function ProposalList() {
  return (
    <MainSection>
      <div className="flex w-full max-w-[1280] flex-col gap-x-10 gap-y-8 lg:flex-row">
        <div className="flex flex-1 flex-col gap-y-6">
          <div className="flex items-start justify-between">
            <Heading size="h1">Standard Proposals</Heading>
          </div>
          <PublicProposals />
        </div>
        <AsideSection />
      </div>
    </MainSection>
  );
}

function AsideSection() {
  return (
    <aside className="flex w-full flex-col gap-y-4 lg:max-w-[280px] lg:gap-y-6">
      <div className="flex flex-col gap-y-3">
        <Heading size="h3">Emergency Proposals</Heading>
        <b>(Visible following execution)</b>

        <ul className="list-inside list-disc">
          <li>Initiated only by Security Council Members</li>
          <li>Executed upon approval from more than 75% of the Security Council members</li>
          <li>
            Relates to any issues/actions relating to:
            <ul className="list-inside list-decimal pl-4">
              <li>the underlying security of the Taiko protocol</li>
              <li>modification(s) critical to integrity of the Taiko protocol and the Security Council</li>
            </ul>
          </li>
        </ul>

        <Heading size="h3">Standard Proposals</Heading>
        <b>(Visible following cretion)</b>
        <ul className="list-inside list-disc">
          <li>Available for public community voting following approval from 3 or 25% of Security Council Members </li>
          <li>Executed if the proposal is not vetoed within 9 days</li>
          <li>30% vote from token holders is required to veto a Standard Proposal</li>
          <li>Relates to any topics/issues that do not fall within the scope of Emergency Proposals</li>
        </ul>
      </div>
      <div className="flex flex-col items-baseline gap-y-2 py-3 lg:gap-x-6 lg:py-4">
        <dt className="line-clamp-1 shrink-0 text-lg leading-tight text-neutral-800 lg:line-clamp-6 lg:w-40">
          About {PUB_APP_NAME}
        </dt>
        <dd className="size-full text-base leading-tight text-neutral-500">
          <a href={PUB_PROJECT_URL} target="_blank" className="font-semibold text-primary-400 underline">
            Learn more about the project
          </a>
        </dd>
      </div>
    </aside>
  );
}
