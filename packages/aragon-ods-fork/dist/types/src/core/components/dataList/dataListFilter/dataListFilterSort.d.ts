import type { IDataListFilterProps } from './dataListFilter';
export interface IDataListFilterSortProps extends Pick<IDataListFilterProps, 'activeSort' | 'sortItems' | 'onSortChange'> {
    /**
     * Classes for the dropdown trigger.
     */
    triggerClassNames?: string;
    /**
     * Label of the dropdown trigger.
     */
    triggerLabel?: string;
}
export declare const DataListFilterSort: React.FC<IDataListFilterSortProps>;
