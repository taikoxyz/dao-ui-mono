import type React from 'react';
import { type IDataListItemProps } from '../../../../../core';
export interface IAssetDataListItemStructureProps extends IDataListItemProps {
    /**
     * The name of the asset.
     */
    name: string;
    /**
     * The symbol of the asset.
     */
    symbol: string;
    /**
     * The amount of the asset.
     */
    amount: number | string;
    /**
     * The logo source of the asset
     */
    logoSrc?: string;
    /**
     * The fiat price of the asset.
     */
    fiatPrice?: number | string;
    /**
     * The price change in percentage of the asset (E.g. in last 24h).
     * @default 0
     */
    priceChange?: number;
}
export declare const AssetDataListItemStructure: React.FC<IAssetDataListItemStructureProps>;
