import { type ComponentProps } from 'react';
export interface IDataListFilterSortItem {
    /**
     * Value of the sort item.
     */
    value: string;
    /**
     * Label of the sort item.
     */
    label: string;
    /**
     * Sort item type to display the correct icon on the sort button.
     */
    type: 'ASC' | 'DESC';
}
export interface IDataListFilterProps extends Omit<ComponentProps<'div'>, 'onChange'> {
    /**
     * Placeholder of the search bar.
     */
    placeholder?: string;
    /**
     * Current value of the search bar.
     */
    searchValue?: string;
    /**
     * Callback called on search value change.
     */
    onSearchValueChange: (value?: string) => void;
    /**
     * Active sorting of the data list.
     */
    activeSort?: string;
    /**
     * Sort items displayed on the sort dropdown.
     */
    sortItems?: IDataListFilterSortItem[];
    /**
     * Callback called on sort change.
     */
    onSortChange?: (sort: string) => void;
    /**
     * Callback called on filter button click. The filter button is not displayed when the callback is not defined.
     */
    onFilterClick?: () => void;
    /**
     * Callback called on reset filters button click. The reset filters button is not displayed when the callback is not defined.
     */
    onResetFiltersClick?: () => void;
}
export declare const DataListFilter: React.FC<IDataListFilterProps>;
