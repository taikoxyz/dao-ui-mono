import { useState } from "react";
import { CardEmptyState, DataList } from "@aragon/ods";
import { DelegateListItem } from "./DelegateListItem";
import { equalAddresses } from "@/utils/evm";
import { useDelegates } from "../hooks/useDelegates";
import { useTokenVotes } from "../../../hooks/useTokenVotes";
import { useAccount } from "wagmi";
import VerifiedDelegates from "../../../verified-delegates.json";
import { PleaseWaitSpinner } from "@/components/please-wait";
// import { generateSortOptions, sortItems } from "./utils";

interface IDelegateMemberListProps {
  verifiedOnly?: boolean;
}

export const DelegateMemberList: React.FC<IDelegateMemberListProps> = ({ verifiedOnly }) => {
  const { address } = useAccount();
  const [searchValue, setSearchValue] = useState<string>();
  //   const [activeSort, setActiveSort] = useState<string>();
  const { delegates: fetchedDelegates, status: loadingStatus } = useDelegates();
  const { delegatesTo } = useTokenVotes(address);
  const delegates = (fetchedDelegates || []).filter((item) => {
    if (!verifiedOnly) return true;
    return VerifiedDelegates.findIndex((d) => equalAddresses(d.address, item)) >= 0;
  });

  if (loadingStatus === "pending" && !delegates?.length) {
    return <PleaseWaitSpinner fullMessage="Please wait, loading candidates" />;
  } else if (!delegates?.length) {
    return <NoDelegatesView verified={verifiedOnly} />;
  }

  const filteredDelegates = (delegates || []).filter((item) => {
    if (!searchValue?.trim()) return true;
    return item.toLowerCase().includes(searchValue.toLowerCase());
  });

  const totalMembers = filteredDelegates.length || 0;
  const showPagination = false;
  // const showPagination = (totalMembers ?? 0) > DEFAULT_PAGE_SIZE;

  if (!totalMembers) {
    return <NoDelegatesView filtered={!!searchValue?.trim()} verified={verifiedOnly} />;
  }

  return (
    <DataList.Root
      entityLabel={totalMembers === 1 ? "delegate" : "delegates"}
      itemsCount={totalMembers}
      // pageSize={DEFAULT_PAGE_SIZE}
      // state={dataListState}
      // onLoadMore={fetchNextPage}
    >
      <DataList.Filter
        onSearchValueChange={setSearchValue}
        searchValue={searchValue}
        placeholder="Filter by address"
        // onSortChange={setActiveSort}
        // activeSort={activeSort}
        // sortItems={sortItems}
      />
      <DataList.Container
        // SkeletonElement={MemberDataListItem.Skeleton}
        // errorState={errorState}
        // emptyState={emptyState}
        className="grid grid-cols-[repeat(auto-fill,_minmax(200px,_1fr))] gap-3"
      >
        {filteredDelegates.map((delegate) => (
          <DelegateListItem
            isMyDelegate={equalAddresses(delegatesTo, delegate)}
            key={delegate}
            href={"#/delegates/" + delegate}
            address={delegate}
          />
        ))}
      </DataList.Container>
      {showPagination && <DataList.Pagination />}
    </DataList.Root>
  );
};

function NoDelegatesView({ verified, filtered }: { verified?: boolean; filtered?: boolean }) {
  let message: string;
  if (filtered) {
    if (verified) {
      message =
        "There are no verified delegate profiles matching the current filter. Please try entering a different search term.";
    } else {
      message = "No delegate announcements match the current filter. Please try entering a different search term.";
    }
  } else {
    if (verified) {
      message =
        "There are no verified delegate profiles with a public announcement yet. Here you will see the addresses of members who have posted their candidacy to be delegated to. Be the first to post an announcement and get noticed by the communnity.";
    } else {
      message =
        "No delegate announcements have been posted yet. Here you will see the addresses of members who have posted their candidacy to be delegated to. Be the first to post an announcement and get noticed by the communnity.";
    }
  }

  return (
    <CardEmptyState
      heading="Delegate announcements"
      description={message}
      humanIllustration={{
        body: "VOTING",
        expression: "CASUAL",
        hairs: "CURLY",
      }}
    />
  );
}
