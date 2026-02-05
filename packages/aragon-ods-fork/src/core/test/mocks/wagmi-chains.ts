export type Chain = {
    id: number;
    name?: string;
    blockExplorers?: {
        default: {
            url: string;
        };
    };
};

const createChain = (id: number, name: string, url: string): Chain => ({
    id,
    name,
    blockExplorers: {
        default: {
            url,
        },
    },
});

export const mainnet = createChain(1, 'mainnet', 'https://etherscan.io');
export const sepolia = createChain(11155111, 'sepolia', 'https://sepolia.etherscan.io');
export const polygon = createChain(137, 'polygon', 'https://polygonscan.com');
export const polygonAmoy = createChain(80002, 'polygon-amoy', 'https://www.oklink.com/amoy');
export const arbitrum = createChain(42161, 'arbitrum', 'https://arbiscan.io');
export const arbitrumSepolia = createChain(421614, 'arbitrum-sepolia', 'https://sepolia.arbiscan.io');
export const base = createChain(8453, 'base', 'https://basescan.org');
export const baseSepolia = createChain(84532, 'base-sepolia', 'https://sepolia.basescan.org');
