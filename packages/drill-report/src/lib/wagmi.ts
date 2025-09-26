import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, holesky } from '@reown/appkit/networks';
import { defineChain } from 'viem';
import { http } from '@wagmi/core';

// Use a placeholder project ID if not configured
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '2f05a2c33e87c088e2f5b1e30f6d7e76';

// Define Taiko chain
const taiko = defineChain({
	id: 167000,
	name: 'Taiko',
	nativeCurrency: {
		decimals: 18,
		name: 'Ether',
		symbol: 'ETH',
	},
	rpcUrls: {
		default: {
			http: ['https://rpc.mainnet.taiko.xyz'],
		},
	},
	blockExplorers: {
		default: { name: 'Taikoscan', url: 'https://taikoscan.io' },
	},
});

const metadata = {
	name: 'Taiko DAO Drill Report',
	description: 'View and analyze Taiko DAO drill reports',
	url: 'https://drill-report.taiko.xyz',
	icons: ['https://taiko.xyz/favicon.ico']
};

export const networks = [mainnet, holesky, taiko];

// Configure with public RPC endpoints as fallback
export const wagmiAdapter = new WagmiAdapter({
	networks,
	projectId,
	transports: {
		[mainnet.id]: http('https://ethereum-rpc.publicnode.com'),
		[holesky.id]: http('https://holesky.drpc.org'),
		[taiko.id]: http('https://rpc.mainnet.taiko.xyz')
	}
});

export const config = wagmiAdapter.wagmiConfig;

let appKitInstance: any = null;

export function initializeAppKit() {
	if (!appKitInstance && typeof window !== 'undefined') {
		appKitInstance = createAppKit({
			adapters: [wagmiAdapter],
			networks,
			projectId,
			metadata,
			features: {
				analytics: true
			}
		});
	}
	return appKitInstance;
}