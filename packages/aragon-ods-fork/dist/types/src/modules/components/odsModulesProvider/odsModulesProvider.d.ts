import { QueryClient } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { type Config, type State } from 'wagmi';
import { type IOdsCoreProviderProps } from '../../../core';
import { type ModulesCopy } from '../../assets';
export interface IOdsModulesContext {
    /**
     * Copy for the modules components.
     */
    copy: ModulesCopy;
}
export interface IOdsModulesProviderProps {
    /**
     * Wagmi configurations to be forwarded to the WagmiProvider. The default configurations support some basic chains
     * (ethereum, base, polygon, arbitrum) and their related testnets and uses open RPC endpoints, @see defaultWagmiConfig
     * @default defaultWagmiConfig
     */
    wagmiConfig?: Config;
    /**
     * Optional initial state for Wagmi provider.
     */
    wagmiInitialState?: State;
    /**
     * React-query configurations to be forwarded to the QueryClientProvider, uses the defaults configurations from
     * react-query when not specified (see https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults).
     * @default defaultQueryClient
     */
    queryClient?: QueryClient;
    /**
     * Values for the OdsCoreProvider context.
     * @see IOdsCoreContext
     */
    coreProviderValues?: IOdsCoreProviderProps['values'];
    /**
     * Context provider values.
     */
    values?: Partial<IOdsModulesContext>;
    /**
     * Children of the provider.
     */
    children?: ReactNode;
}
export declare const OdsModulesProvider: React.FC<IOdsModulesProviderProps>;
export declare const useOdsModulesContext: () => IOdsModulesContext;
