import { useEffect } from "react";
import { useBlockNumber, useReadContract } from "wagmi";
import ProposalCard from "@/plugins/emergency-multisig/components/proposal";
import { EmergencyMultisigPluginAbi } from "@/plugins/emergency-multisig/artifacts/EmergencyMultisigPlugin";
import { CardEmptyState, DataList, ProposalDataListItemSkeleton, type DataListState } from "@aragon/ods";
import { useCanCreateProposal } from "@/plugins/emergency-multisig/hooks/useCanCreateProposal";
import { Else, If, Then } from "@/components/if";
import { PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS, PUB_CHAIN } from "@/constants";
import { EncryptionPlaceholderOrChildren } from "../components/encryption-check-or-children";
import { useRouter } from "next/router";

const DEFAULT_PAGE_SIZE = 6;

export default function Proposals() {
  const { push } = useRouter();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const { canCreate } = useCanCreateProposal();
  const {
    data: proposalCountResponse,
    error: isError,
    isLoading,
    isFetching: isFetchingNextPage,
    refetch,
  } = useReadContract({
    address: PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS,
    abi: EmergencyMultisigPluginAbi,
    functionName: "proposalCount",
    chainId: PUB_CHAIN.id,
  });
  const proposalCount = proposalCountResponse ? Number(proposalCountResponse) : 0;

  useEffect(() => {
    refetch();
  }, [blockNumber, refetch]);

  const entityLabel = proposalCount === 1 ? "Proposal" : "Proposals";

  let dataListState: DataListState = "idle";
  if (isLoading && !proposalCount) {
    dataListState = "initialLoading";
  } else if (isError) {
    dataListState = "error";
  } else if (isFetchingNextPage) {
    dataListState = "fetchingNextPage";
  }

  return (
    <div>
      <EncryptionPlaceholderOrChildren needsPublicKey={true}>
        <If condition={!proposalCount}>
          <Then>
            <If condition={canCreate}>
              <Then>
                <CardEmptyState
                  heading="No proposals yet"
                  description="The list of proposals is currently empty. Be the first one to create a proposal."
                  objectIllustration={{
                    object: "ACTION",
                  }}
                  primaryButton={{
                    label: "Submit a proposal",
                    onClick: () => push("/plugins/emergency-council/#/new"),
                  }}
                />
              </Then>
              <Else>
                <CardEmptyState
                  heading="No proposals yet"
                  description="The list of proposals is currently empty. Here you will see the proposals created by the Security Council before a super majority can enact an emergency execution on the DAO."
                  objectIllustration={{
                    object: "ACTION",
                  }}
                />
              </Else>
            </If>
          </Then>
          <Else>
            <DataList.Root
              entityLabel={entityLabel}
              itemsCount={proposalCount}
              pageSize={DEFAULT_PAGE_SIZE}
              state={dataListState}
              //onLoadMore={fetchNextPage}
            >
              <DataList.Container SkeletonElement={ProposalDataListItemSkeleton}>
                {proposalCount &&
                  Array.from(Array(proposalCount || 0)?.keys())
                    .reverse()
                    ?.map((proposalIndex) => (
                      // TODO: update with router agnostic ODS DataListItem
                      <ProposalCard key={proposalIndex} proposalId={BigInt(proposalIndex)} />
                    ))}
              </DataList.Container>
              <DataList.Pagination />
            </DataList.Root>
          </Else>
        </If>
      </EncryptionPlaceholderOrChildren>
    </div>
  );
}
