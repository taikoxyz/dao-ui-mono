import { type IDataListItemProps } from '../../../../../core';
export interface IMemberDataListItemProps extends IDataListItemProps {
    /**
     * Whether the member is a delegate of current user or not.
     */
    isDelegate?: boolean;
    /**
     * The number of delegations the member has from other members.
     */
    delegationCount?: number;
    /**
     * The total amount of tokens.
     */
    tokenAmount?: number | string;
    /**
     * ENS name of the user.
     */
    ensName?: string;
    /**
     * 0x address of the user.
     */
    address: string;
    /**
     * Direct URL src of the user avatar image to be rendered.
     */
    avatarSrc?: string;
    /**
     * Hide token voting label
     */
    hideLabelTokenVoting?: boolean;
    /**
     * Token Symbol.
     */
    tokenSymbol?: string;
}
export declare const MemberDataListItemStructure: React.FC<IMemberDataListItemProps>;
