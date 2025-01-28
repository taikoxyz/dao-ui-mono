import type React from 'react';
import { type IDataListItemProps } from '../../../../../core';
export interface IDaoDataListItemStructureProps extends IDataListItemProps {
    /**
     * The name of the DAO.
     */
    name?: string;
    /**
     * The source of the logo for the DAO.
     */
    logoSrc?: string;
    /**
     * The description of the DAO.
     */
    description?: string;
    /**
     * The address of the DAO.
     */
    address?: string;
    /**
     * The ENS (Ethereum Name Service) address of the DAO.
     */
    ens?: string;
    /**
     * The plugin used by the DAO.
     * @default token-based
     */
    plugin?: string;
    /**
     * The network on which the DAO operates.
     */
    network?: string;
}
export declare const DaoDataListItemStructure: React.FC<IDaoDataListItemStructureProps>;
