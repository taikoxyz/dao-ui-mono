import React from 'react';

export type Config = { chains: Array<{ id: number; blockExplorers?: { default: { url: string } } }> };
export type State = unknown;
export type UseEnsAddressReturnType = any;
export type UseEnsNameReturnType = any;
export type UseEnsAddressParameters = any;
export type UseEnsNameParameters = any;

export const WagmiProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
    React.createElement('div', null, children);
export const createConfig = <T extends Config>(config: T): T => config;

const defaultChain = {
    id: 1,
    blockExplorers: {
        default: {
            url: 'https://etherscan.io',
        },
    },
};

export const useAccount = () => ({ address: undefined, isConnected: false });
export const useEnsName = () => ({ data: undefined });
export const useEnsAddress = () => ({ data: undefined });
export const useEnsAvatar = () => ({ data: undefined });
export const useChains = () => [defaultChain];
export const useConfig = () => ({ chains: [defaultChain] });

export const http = () => ({
    url: '',
});
