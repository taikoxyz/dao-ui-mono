import { PUB_TOKEN_SYMBOL } from "@/constants";
import { formatHexString, equalAddresses } from "@/utils/evm";
import {
  Breadcrumbs,
  Button,
  Dropdown,
  Heading,
  IconType,
  MemberAvatar,
  clipboardUtils,
  type IBreadcrumbsLink,
} from "@aragon/ods";
import { type Address } from "viem";
import { mainnet } from "viem/chains";
import { useAccount, useEnsName } from "wagmi";
import { useTokenVotes, useTokenTotalSupply } from "../../../hooks/useTokenVotes";
import { Else, ElseIf, If, Then } from "@/components/if";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { useDelegateVotingPower } from "../hooks/useDelegateVotingPower";
import VerifiedDelegates from "@/data/verified-delegates.json";
import { formatTokenAmount, formatPercentage } from "../utils/formatting";

interface IHeaderMemberProps {
  name?: string;
  address: Address;
  bio?: string;
}

export const HeaderMember: React.FC<IHeaderMemberProps> = (props) => {
  const { address: delegateAddress, bio, name } = props;
  const breadcrumbs: IBreadcrumbsLink[] = [{ label: "Delegates", href: "#/" }, { label: props.address }];
  const { open } = useWeb3Modal();
  const { address: myAddress, isConnected } = useAccount();
  const { data: ensName } = useEnsName({ chainId: mainnet.id, address: delegateAddress });
  const { votingPower, balance: delegateTokenBalance, refetch } = useTokenVotes(delegateAddress);
  const { totalSupply } = useTokenTotalSupply();
  const { delegatesTo } = useTokenVotes(myAddress);
  const { delegateVotingPower, isLoading: isConfirming } = useDelegateVotingPower(delegateAddress, refetch);
  const formattedAddress = formatHexString(delegateAddress);
  const isVerified = VerifiedDelegates.findIndex((d) => equalAddresses(d.address, delegateAddress)) >= 0;

  const votingPowerFormatted = votingPower ? formatTokenAmount(votingPower) : null;
  const balanceFormatted = delegateTokenBalance ? formatTokenAmount(delegateTokenBalance) : null;
  const delegatedPower = votingPower && delegateTokenBalance ? votingPower - delegateTokenBalance : null;
  const delegatedFormatted = delegatedPower && delegatedPower > 0n ? formatTokenAmount(delegatedPower) : null;
  const votingPowerPercentage = votingPower && totalSupply ? formatPercentage(votingPower, totalSupply) : null;

  return (
    <div className="flex w-full justify-center bg-neutral-0 from-neutral-0 to-transparent">
      <div className="flex w-full max-w-screen-xl flex-col gap-y-6 px-4 py-6 md:px-16 md:py-10">
        <Breadcrumbs
          links={breadcrumbs.map((v) => ({ ...v, label: formatHexString(v.label) }))}
          tag={isVerified ? { label: "Verified", variant: "success" } : { label: "Unverified" }}
        />

        {/* Content Wrapper */}
        <div className="flex flex-col gap-y-4">
          <div className="flex w-full md:gap-x-20">
            <div className="flex w-full max-w-[720px] flex-col gap-y-4">
              <Heading size="h1">{name ?? formattedAddress}</Heading>
              {/* Bio */}
              {bio && <p className="text-lg text-neutral-500">{bio}</p>}
              
              {/* Voting Power Stats */}
              <If condition={!!votingPower && votingPower > 0n}>
                <div className="flex flex-col gap-y-3 pt-4 md:flex-row md:gap-x-8">
                  <div className="flex flex-col gap-y-1">
                    <div className="flex items-baseline gap-x-2">
                      <span 
                        className="text-2xl font-semibold text-neutral-800 cursor-help" 
                        title={votingPowerFormatted ? `${votingPowerFormatted.full} ${PUB_TOKEN_SYMBOL}` : undefined}
                      >
                        {votingPowerFormatted?.formatted ?? "0"}
                      </span>
                      <span className="text-base text-neutral-500">{PUB_TOKEN_SYMBOL}</span>
                      {votingPowerPercentage && (
                        <span className="text-sm px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                          {votingPowerPercentage}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-neutral-500">Total voting power</span>
                  </div>
                  <If condition={!!delegateTokenBalance && delegateTokenBalance > 0n}>
                    <div className="flex flex-col gap-y-1">
                      <div className="flex items-baseline gap-x-1">
                        <span 
                          className="text-lg text-neutral-800 cursor-help"
                          title={balanceFormatted ? `${balanceFormatted.full} ${PUB_TOKEN_SYMBOL}` : undefined}
                        >
                          {balanceFormatted?.formatted ?? "0"}
                        </span>
                        <span className="text-sm text-neutral-500">{PUB_TOKEN_SYMBOL}</span>
                      </div>
                      <span className="text-sm text-neutral-500">Own tokens</span>
                    </div>
                  </If>
                  <If condition={!!delegatedFormatted}>
                    <div className="flex flex-col gap-y-1">
                      <div className="flex items-baseline gap-x-1">
                        <span 
                          className="text-lg text-neutral-800 cursor-help"
                          title={delegatedFormatted ? `${delegatedFormatted.full} ${PUB_TOKEN_SYMBOL}` : undefined}
                        >
                          {delegatedFormatted?.formatted ?? "0"}
                        </span>
                        <span className="text-sm text-neutral-500">{PUB_TOKEN_SYMBOL}</span>
                      </div>
                      <span className="text-sm text-neutral-500">Delegated from others</span>
                    </div>
                  </If>
                </div>
              </If>
            </div>
            <span>
              <MemberAvatar address={delegateAddress} size="lg" responsiveSize={{}} />
            </span>
          </div>
          
          <div>
            <span className="flex w-full flex-col gap-x-4 gap-y-3 md:flex-row">
              <If condition={!isConnected}>
                <Then>
                  <Button onClick={() => open()}>Connect to delegate</Button>
                </Then>
                <ElseIf condition={equalAddresses(delegateAddress, delegatesTo)}>
                  <Button disabled={true}>Already delegated</Button>
                </ElseIf>
                <ElseIf condition={equalAddresses(delegateAddress, myAddress)}>
                  <If condition={(delegateTokenBalance ?? BigInt(0)) > BigInt(0)}>
                    <Button isLoading={isConfirming} onClick={delegateVotingPower}>
                      Reclaim voting power
                    </Button>
                  </If>
                </ElseIf>
                <Else>
                  <Button isLoading={isConfirming} onClick={delegateVotingPower}>
                    Delegate voting power
                  </Button>
                </Else>
              </If>

              <Dropdown.Container
                customTrigger={
                  <Button variant="tertiary" iconRight={IconType.CHEVRON_DOWN}>
                    {ensName ?? formattedAddress}
                  </Button>
                }
              >
                <If condition={!!ensName?.trim()}>
                  <Dropdown.Item
                    icon={IconType.COPY}
                    iconPosition="right"
                    onClick={() => clipboardUtils.copy(ensName ?? "")}
                  >
                    {ensName}
                  </Dropdown.Item>
                </If>
                <Dropdown.Item
                  icon={IconType.COPY}
                  iconPosition="right"
                  onClick={() => clipboardUtils.copy(delegateAddress)}
                >
                  {formattedAddress}
                </Dropdown.Item>
              </Dropdown.Container>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
