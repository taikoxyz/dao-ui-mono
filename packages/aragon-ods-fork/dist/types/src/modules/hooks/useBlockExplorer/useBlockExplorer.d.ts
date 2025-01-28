import { type Config } from 'wagmi';
export declare enum ChainEntityType {
    ADDRESS = "address",
    TRANSACTION = "tx",
    TOKEN = "token"
}
export interface IUseBlockExplorerParams {
    /**
     * Chains definitions to use for returning the block explorer definitions and building the URLs. Defaults to the
     * chains defined on the Wagmi context provider.
     */
    chains?: Config['chains'];
    /**
     * Uses the block explorer definition of the specified Chain ID when set. Defaults to the ID of the first chain on
     * the chains list.
     */
    chainId?: number;
}
export interface IBuildEntityUrlParams {
    /**
     * The type of the entity (e.g. address, transaction, token)
     */
    type: ChainEntityType;
    /**
     * ID of the chain related to the entity. When set, overrides the chainId set as hook parameter.
     */
    chainId?: number;
    /**
     * The ID of the entity (e.g. transaction hash for a transaction)
     */
    id?: string;
}
export declare const useBlockExplorer: (params?: IUseBlockExplorerParams) => {
    blockExplorer: {
        name: string;
        url: string;
        apiUrl?: string | undefined;
    } | undefined;
    getBlockExplorer: (chainId?: number) => {
        name: string;
        url: string;
        apiUrl?: string | undefined;
    } | undefined;
    buildEntityUrl: ({ type, chainId, id }: IBuildEntityUrlParams) => string | undefined;
};
