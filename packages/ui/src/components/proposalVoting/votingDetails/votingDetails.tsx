import { Else, If, Then } from "@/components/if";
import { AddressText } from "@/components/text/address";
import { DefinitionList, Heading, IconType, Link } from "@aragon/ods";
import { Address, formatUnits } from "viem";
import { compactNumber, formatExactTokenAmount } from "@/utils/numbers";

export interface IVotingDetailsProps {
  startDate?: string;
  endDate: string;
  snapshotTakenAt: string;
  snapshotBlockURL?: string;
  tokenAddress?: Address;
  options: string;
  strategy: string;
  totalVotingPower?: bigint;
  tokenSymbol?: string;
}

export const VotingDetails: React.FC<IVotingDetailsProps> = (props) => {
  const {
    startDate,
    endDate,
    snapshotBlockURL,
    snapshotTakenAt,
    tokenAddress,
    options,
    strategy,
    totalVotingPower,
    tokenSymbol = "TAIKO",
  } = props;

  return (
    <div className="flex flex-col gap-y-3">
      <div>
        <Heading size="h4">Voting</Heading>
        <DefinitionList.Container className="">
          <If condition={startDate}>
            <DefinitionList.Item term="Starting" className="!gap-y-1 *:text-neutral-500">
              <div className="w-full text-neutral-800 md:text-right">{startDate}</div>
            </DefinitionList.Item>
          </If>
          <DefinitionList.Item term="Ending" className="!gap-y-1 *:text-neutral-500">
            <div className="w-full text-neutral-800 md:text-right">{endDate}</div>
          </DefinitionList.Item>
          <DefinitionList.Item term="Census Snapshot" className="!gap-y-1 *:text-neutral-500">
            <div className="w-full text-neutral-800 md:text-right">
              <If condition={!!snapshotBlockURL}>
                <Then>
                  <Link iconRight={IconType.LINK_EXTERNAL} href={snapshotBlockURL} target="_blank">
                    {snapshotTakenAt}
                  </Link>
                </Then>
                <Else>{snapshotTakenAt}</Else>
              </If>
            </div>
          </DefinitionList.Item>
          <If condition={totalVotingPower !== undefined && totalVotingPower !== null}>
            <DefinitionList.Item term="Total Voting Power" className="!gap-y-1 *:text-neutral-500">
              <div
                className="w-full text-neutral-800 md:text-right"
                title={
                  totalVotingPower && totalVotingPower > 0n
                    ? `${formatExactTokenAmount(formatUnits(totalVotingPower, 18))} ${tokenSymbol}`
                    : undefined
                }
              >
                {totalVotingPower && totalVotingPower > 0n
                  ? `${compactNumber(formatUnits(totalVotingPower, 18))} ${tokenSymbol}`
                  : "-"}
              </div>
            </DefinitionList.Item>
          </If>
        </DefinitionList.Container>
      </div>
      <div>
        <Heading size="h4">Governance Settings</Heading>
        <DefinitionList.Container>
          <If condition={!!tokenAddress}>
            <DefinitionList.Item term="Token contract" className="!gap-y-1 *:text-neutral-500">
              <div className="w-full text-ellipsis text-neutral-800 md:text-right">
                <AddressText>{tokenAddress}</AddressText>
              </div>
            </DefinitionList.Item>
          </If>
          <DefinitionList.Item term="Strategy" className="!gap-y-1 *:text-neutral-500">
            <div className="w-full text-neutral-800 md:text-right">{strategy}</div>
          </DefinitionList.Item>
          <DefinitionList.Item term="Voting options" className="!gap-y-1 *:text-neutral-500">
            <div className="w-full text-neutral-800 md:text-right">{options}</div>
          </DefinitionList.Item>
        </DefinitionList.Container>
      </div>
    </div>
  );
};
