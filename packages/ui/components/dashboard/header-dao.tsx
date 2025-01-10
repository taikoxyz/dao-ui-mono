import { PUB_APP_NAME } from "@/constants";
// import { proposalList } from "@/plugins/snapshot/services/proposals";
// import { useTotalTokensLocked } from "@/plugins/votingEscrow/hooks/useTotalTokensLocked";
import { formatterUtils, Heading, NumberFormat, StateSkeletonBar } from "@aragon/ods";
// import { useInfiniteQuery } from "@tanstack/react-query";
// import { formatUnits } from "viem";

export const HeaderDao = () => {
  // const {
  //   data: totalProposals,
  //   isLoading: totalProposalsLoading,
  //   isFetched: totalProposalsFetched,
  //   error: totalProposalsError,
  // } = useInfiniteQuery({
  //   ...proposalList({ limit: 6 }),
  //   select: (data) => data.pages.flat().length,
  // });

  // const {
  //   data: totalVotingPower,
  //   isLoading: totalVotingPowerLoading,
  //   isFetched: totalVotingPowerFetched,
  // } = useTotalVotingPower();

  // const {
  //   data: totalTokensLocked,
  //   isLoading: totalTokensLockedLoading,
  //   isFetched: totalTokensFetched,
  // } = useTotalTokensLocked();

  // const totalProposalCountFetched = totalProposalsFetched && !totalProposalsLoading;

  return (
    <header className="relative flex w-full justify-center">
      {/* Radial gradients */}
      <section className="absolute right-[80px] top-[70px] -z-10 size-[180px] rounded-full bg-ellipse-34 blur-[120px] sm:right-[80px] sm:size-[320px]" />
      <section className="absolute left-[68px] top-[170px] -z-10 size-[250px] rounded-full bg-ellipse-35 blur-[80px] sm:size-[400px]" />
      <section className="absolute right-[400px] top-[153px] -z-10 hidden size-[540px] rounded-full bg-ellipse-36 blur-[120px] lg:block" />

      <div className="flex w-full max-w-screen-xl flex-col gap-y-6">
        <div className="flex flex-col gap-y-8">
          <div className="md:w-4/5">
            <p className="text-xl leading-normal text-neutral-600 md:text-2xl">
              Welcome to the {PUB_APP_NAME} DAO's Governance app. Use this tool to engage with the community and shape
              the future direction of the protocol.
            </p>
            <ul className="list-disc list-inside">
              <li>explain the dao is currently on l1, but will eventually move onto l2</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-x-20 gap-y-4 sm:flex-row md:w-4/5">
          {/* Proposal count */}
          {/* {totalProposalCountFetched && !totalProposalsError && (
            <div className="flex flex-col">
              <span className="text-2xl text-neutral-800 md:text-3xl">
                {formatterUtils.formatNumber(totalProposals, { format: NumberFormat.GENERIC_SHORT })}
              </span>
              <span className="text-xl text-neutral-500">{totalProposals === 1 ? "Proposal" : "Proposals"}</span>
            </div>
          )}
          {totalProposalsLoading && (
            <div className="flex w-24 flex-col justify-between gap-y-3 pb-1 pt-3">
              <StateSkeletonBar size="2xl" className="h-[30px] !bg-neutral-100 py-4" width={"65%"} />
              <StateSkeletonBar size="xl" className="!bg-neutral-100" width={"100%"} />
            </div>
          )} */}
          {/*
          {totalVotingPowerFetched && totalVotingPower && (
            <div className="flex flex-col">
              <span className="text-3xl text-neutral-800 md:text-3xl">
                {formatterUtils.formatNumber(formatUnits(totalVotingPower, PUB_TOKEN_DECIMALS), {
                  format: NumberFormat.TOKEN_AMOUNT_SHORT,
                })}
              </span>
              <span className="text-xl text-neutral-500">Locked voting power</span>
            </div>
          )}

          {totalVotingPowerLoading && (
            <div className="flex w-24 flex-col justify-between gap-y-3 pb-1 pt-3">
              <StateSkeletonBar size="2xl" className="h-[30px] !bg-neutral-100 py-4" width={"65%"} />
              <StateSkeletonBar size="xl" className="!bg-neutral-100" width={"100%"} />
            </div>
          )} */}

          {/* {totalTokensFetched && totalTokensLocked != null && (
            <div className="flex flex-col">
              <div className="flex items-center gap-x-1">
                <span className="text-2xl text-neutral-800 md:text-3xl">
                  {formatterUtils.formatNumber(formatUnits(totalTokensLocked, PUB_TOKEN_DECIMALS), {
                    format: NumberFormat.TOKEN_AMOUNT_SHORT,
                    maxFractionDigits: 2,
                  })}
                </span>
                <span className="text-xl leading-tight text-neutral-500 md:text-2xl">{PUB_TOKEN_SYMBOL}</span>
              </div>
              <span className="text-xl text-neutral-500">{`Total tokens locked`}</span>
            </div>
          )}
          {totalTokensLockedLoading && (
            <div className="flex w-24 flex-col justify-between gap-y-3 pb-1 pt-3">
              <StateSkeletonBar size="2xl" className="h-[30px] !bg-neutral-100 py-4" width={"65%"} />
              <StateSkeletonBar size="xl" className="!bg-neutral-100" width={"100%"} />
            </div>
          )} */}
        </div>
      </div>
    </header>
  );
};
