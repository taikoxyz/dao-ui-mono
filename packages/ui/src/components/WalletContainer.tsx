import { PUB_CHAIN, PUB_CHAIN_NAME, PUB_WEB3_ENDPOINT } from "@/constants";
import { formatHexString } from "@/utils/evm";
import { MemberAvatar } from "@aragon/ods";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import classNames from "classnames";
import { useEffect } from "react";
import { createClient, http } from "viem";
import { normalize } from "viem/ens";
import { createConfig, useAccount, useEnsAvatar, useEnsName, useSwitchChain } from "wagmi";
import { holesky, mainnet } from "wagmi/chains";

const activeChain = PUB_CHAIN_NAME === "holesky" ? holesky : mainnet;

const config = createConfig({
  chains: [mainnet, holesky],
  ssr: true,
  client({ chain }) {
    return createClient({
      chain,
      transport: http(PUB_WEB3_ENDPOINT, { batch: true }),
    });
  },
});

// TODO: update with ODS wallet module - [https://linear.app/aragon/issue/RD-198/create-ods-walletmodule]
const WalletContainer = () => {
  const { open } = useWeb3Modal();
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const { data: ensName } = useEnsName({
    config,
    chainId: activeChain.id,
    address: address,
  });

  const { data: ensAvatar } = useEnsAvatar({
    config,
    name: normalize(ensName!),
    chainId: activeChain.id,
    gatewayUrls: ["https://cloudflare-ipfs.com"],
    query: { enabled: !!ensName },
  });

  useEffect(() => {
    if (!chainId) return;
    else if (chainId === PUB_CHAIN.id) return;

    switchChain({ chainId: PUB_CHAIN.id });
  }, [chainId, switchChain]);

  return (
    <button
      className={classNames(
        "shrink-none flex h-12 items-center rounded-full border border-neutral-100 bg-neutral-0 leading-tight text-neutral-500",
        "outline-none focus:outline-none focus-visible:ring focus-visible:ring-primary focus-visible:ring-offset", // focus styles
        { "px-1 md:px-0 md:pl-4 md:pr-1": isConnected },
        { "px-4": !isConnected }
      )}
      onClick={() => open()}
    >
      {isConnected && address && (
        <div className="flex items-center gap-3">
          <span className="hidden md:block">{ensName ?? formatHexString(address)}</span>
          <MemberAvatar src={ensAvatar ?? ""} address={address} alt="Profile picture" size="md" />
        </div>
      )}

      {!isConnected && <span>Connect</span>}
    </button>
  );
};

export default WalletContainer;
