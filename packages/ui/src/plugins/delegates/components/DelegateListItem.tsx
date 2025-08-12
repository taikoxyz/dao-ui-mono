import { Else, ElseIf, If, Then } from "@/components/if";
import { formatHexString, equalAddresses } from "@/utils/evm";
import { type IDataListItemProps, DataList, MemberAvatar, Tag } from "@aragon/ods";
import { useAccount } from "wagmi";
import { Address } from "viem";
import { useTokenVotes, useTokenTotalSupply } from "../../../hooks/useTokenVotes";
import VerifiedDelegates from "@/data/verified-delegates.json";
import BannedDelegates from "@/data/banned-delegates.json";
import { useDelegateAnnounce } from "../hooks/useDelegateAnnounce";
import { useProfanityChecker } from "glin-profanity";
import { GlinConfig, PUB_TOKEN_SYMBOL } from "@/constants";
import { useEffect } from "react";
import { formatTokenAmount, formatPercentage } from "../utils/formatting";

export interface IDelegateListItemProps extends IDataListItemProps {
  /** Whether the member is a delegate of current user or not */
  isMyDelegate?: boolean;
  /** 0x address of the user */
  address: Address;
  /** Direct URL src of the user avatar image to be rendered */
  avatarSrc?: string;
  moderatedOnly?: boolean;
}

export const DelegateListItem: React.FC<IDelegateListItemProps> = (props) => {
  const { isMyDelegate, avatarSrc, address, moderatedOnly, ...otherProps } = props;
  const { address: currentUserAddress, isConnected } = useAccount();
  const isCurrentUser = isConnected && address && equalAddresses(currentUserAddress, address);
  const { votingPower } = useTokenVotes(address);
  const { totalSupply } = useTokenTotalSupply();
  const isVerified = VerifiedDelegates.findIndex((d) => equalAddresses(d.address, address)) >= 0;
  const { announce } = useDelegateAnnounce(address);
  const isBanned = BannedDelegates.findIndex((d) => equalAddresses(d.address, address)) >= 0;
  const { result, checkText } = useProfanityChecker(GlinConfig);

  const votingPowerFormatted = votingPower ? formatTokenAmount(votingPower) : null;
  const votingPowerPercentage = votingPower && totalSupply ? formatPercentage(votingPower, totalSupply) : null;

  useEffect(() => {
    if (!announce) return;
    checkText(`${announce.identifier}\n${announce.bio}\n${announce.message}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announce]);

  if (isBanned) {
    return null;
  }
  if (moderatedOnly && result && !result.containsProfanity) {
    return null;
  }

  if (!moderatedOnly && result && result.containsProfanity) {
    return null;
  }

  return (
    <DataList.Item className="w-full !py-0 px-4 md:px-6" {...otherProps}>
      <div className="flex flex-col items-start justify-center gap-y-3 py-4 md:min-w-44 md:py-6">
        <div className="flex w-full items-center justify-between">
          <MemberAvatar address={address} avatarSrc={avatarSrc} responsiveSize={{ md: "md" }} />
          <If condition={isCurrentUser}>
            <Then>
              <Tag variant="neutral" label="You" />
            </Then>
            <ElseIf condition={isMyDelegate}>
              <Tag variant="info" label="Your Delegate" />
            </ElseIf>
            <ElseIf condition={isVerified}>
              <Tag variant="success" label="Verified" />
            </ElseIf>
            <Else>
              <Tag variant="neutral" label="Unverified" />
            </Else>
          </If>
        </div>

        <div className="w-full text-lg text-neutral-800 md:text-xl">
          {result && result.containsProfanity ? (
            <span className="text-red-500">[PROFILE MODERATED]</span>
          ) : (
            <If condition={announce?.identifier}>
              <Then>
                <div className="block w-full overflow-hidden truncate">{announce?.identifier}</div>
                <span className="block text-sm text-neutral-400">{formatHexString(address)}</span>
              </Then>
              <Else>
                <span className="block w-full overflow-hidden truncate text-ellipsis whitespace-nowrap">
                  {formatHexString(address)}
                </span>
              </Else>
            </If>
          )}
        </div>

        <If condition={votingPowerFormatted}>
          <div className="flex h-12 flex-col gap-y-2">
            <div className="flex items-baseline gap-x-2">
              <span className="text-sm text-neutral-500 md:text-base">Voting Power: </span>
              <span
                className="font-medium cursor-help text-sm md:text-base"
                title={votingPowerFormatted ? `${votingPowerFormatted.full} ${PUB_TOKEN_SYMBOL}` : undefined}
              >
                {votingPowerFormatted?.formatted}
              </span>
              <span className="text-sm text-neutral-500">{PUB_TOKEN_SYMBOL}</span>
              {votingPowerPercentage && (
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                  {votingPowerPercentage}
                </span>
              )}
            </div>
          </div>
        </If>
      </div>
    </DataList.Item>
  );
};
