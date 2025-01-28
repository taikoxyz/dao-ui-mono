import { type ComponentProps } from 'react';
import type { IEmptyStateProps } from '../../states';
export interface IDataListContainerState extends Pick<IEmptyStateProps, 'heading' | 'description' | 'primaryButton' | 'secondaryButton'> {
}
export interface IDataListContainerProps extends ComponentProps<'div'> {
    /**
     * Skeleton element displayed when the DataList container state is set to loading.
     */
    SkeletonElement?: React.FC;
    /**
     * Error state displayed when the data list status is set to error.
     */
    errorState?: IDataListContainerState;
    /**
     * Empty state displayed the the data list has no elements to render.
     */
    emptyState?: IDataListContainerState;
    /**
     * Empty state displayed the the data list has no elements to render for the current applied filters.
     */
    emptyFilteredState?: IDataListContainerState;
    /**
     * Classes applied only when displaying the DataListItem components. To be used to apply custom layouts to the
     * children components without affecting the empty/error state layouts.
     */
    layoutClassName?: string;
}
export declare const DataListContainer: React.FC<IDataListContainerProps>;
