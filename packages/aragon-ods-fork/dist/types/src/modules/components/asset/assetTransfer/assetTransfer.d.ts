import { type ICompositeAddress, type IWeb3ComponentProps } from '../../../types';
export interface IAssetTransferProps extends IWeb3ComponentProps {
    /**
     * Sender of the transaction.
     */
    sender: ICompositeAddress;
    /**
     * Recipient of the transaction.
     */
    recipient: ICompositeAddress;
    /**
     * Name of the asset transferred.
     */
    assetName: string;
    /**
     * Icon URL of the transferred asset.
     */
    assetIconSrc?: string;
    /**
     * Asset amount that was transferred.
     */
    assetAmount: number | string;
    /**
     * Symbol of the asset transferred. Example: ETH, DAI, etc.
     */
    assetSymbol: string;
    /**
     * Price per asset in fiat.
     */
    assetFiatPrice?: number | string;
    /**
     * Transaction hash.
     */
    hash: string;
}
export declare const AssetTransfer: React.FC<IAssetTransferProps>;
