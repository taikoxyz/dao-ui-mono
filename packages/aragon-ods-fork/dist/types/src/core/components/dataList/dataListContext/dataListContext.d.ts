import type { IDataListRootProps } from '../dataListRoot';
export interface IDataListContext extends Required<Pick<IDataListRootProps, 'pageSize'>>, Pick<IDataListRootProps, 'itemsCount' | 'state' | 'entityLabel'> {
    /**
     * Total number of list item children.
     */
    childrenItemCount: number;
    /**
     * Callback to update the total number of list item children.
     */
    setChildrenItemCount: (count: number) => void;
    /**
     * Current page being rendered.
     */
    currentPage: number;
    /**
     * Callback called to load more items.
     */
    handleLoadMore: (newPage: number) => void;
}
export declare const DataListContextProvider: import("react").Provider<IDataListContext | null>;
export declare const useDataListContext: () => IDataListContext;
