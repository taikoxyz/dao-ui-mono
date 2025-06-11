import { CardEmptyState, DataList, DataListState, Heading, ProposalDataListItemSkeleton } from "@aragon/ods";
import { Else, If, Then } from "../if";
import { useBlockNumber, useReadContract } from "wagmi";
import { PUB_CHAIN, PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS } from "@/constants";
import { OptimisticTokenVotingPluginAbi } from "@/plugins/optimistic-proposals/artifacts/OptimisticTokenVotingPlugin.sol";
import { useEffect } from "react";
import ProposalCard from "@/plugins/optimistic-proposals/components/proposal";

export const LatestProposals = () => {
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const { data: proposalCountResponse, refetch } = useReadContract({
    address: PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
    abi: OptimisticTokenVotingPluginAbi,
    functionName: "proposalCount",
    chainId: PUB_CHAIN.id,
  });
  const proposalCount = Number(proposalCountResponse);
  const entityLabel = proposalCount === 1 ? "Proposal" : "Proposals";

  useEffect(() => {
    refetch();
  }, [blockNumber]);

  return (
    <section className="flex flex-1 flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <Heading size="h2">Latest proposals</Heading>
      </div>
      <If condition={proposalCount}>
        <Then>
          <DataList.Root entityLabel={entityLabel} pageSize={3}>
            <DataList.Container SkeletonElement={ProposalDataListItemSkeleton}>
              {Array.from(Array(proposalCount || 0)?.keys())
                .slice(-3)
                .reverse()
                ?.map((proposalIndex) => (
                  <ProposalCard
                    linkPrefix="/plugins/community-proposals/"
                    key={proposalIndex}
                    proposalIndex={proposalIndex}
                  />
                ))}
            </DataList.Container>
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
    </section>
  );
};
