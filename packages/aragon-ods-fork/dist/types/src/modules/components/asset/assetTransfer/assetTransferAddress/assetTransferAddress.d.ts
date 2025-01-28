import { type ICompositeAddress } from '../../../../types';
export type TxRole = 'sender' | 'recipient';
export interface IAssetTransferAddressProps {
    /**
     * Role of the transaction participant.
     */
    txRole: TxRole;
    /**
     * Participant of the transfer to display the details for.
     */
    participant: ICompositeAddress;
    /**
     * URL of the block explorer.
     */
    addressUrl?: string;
}
export declare const AssetTransferAddress: React.FC<IAssetTransferAddressProps>;
