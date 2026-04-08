import { polygon, mainnet, sepolia, holesky, arbitrum, polygonMumbai, Chain } from "@wagmi/core/chains";
import { defineChain } from "viem";

export const taiko = defineChain({
  id: 167000,
  name: "Taiko Mainnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.taiko.xyz"] },
  },
  blockExplorers: {
    default: { name: "Taikoscan", url: "https://taikoscan.io" },
  },
});

export const chainNames = ["mainnet", "polygon", "sepolia", "holesky", "mumbai", "arbitrum", "taiko"] as const;
export type ChainName = (typeof chainNames)[number];

export function getChain(chainName: ChainName): Chain {
  switch (chainName) {
    case "mainnet":
      return mainnet;
    case "polygon":
      return polygon;
    case "arbitrum":
      return arbitrum;
    case "sepolia":
      return sepolia;
    case "holesky":
      return holesky;
    case "mumbai":
      return polygonMumbai;
    case "taiko":
      return taiko;
    default:
      throw new Error("Unknown chain");
  }
}
