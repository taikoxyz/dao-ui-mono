import classNames from 'classnames';
import type { ComponentProps } from 'react';
import { Button } from '../../button';
import { useOdsCoreContext } from '../../odsCoreProvider';
import { useDataListContext } from '../dataListContext';

export interface IDataListPaginationProps extends ComponentProps<'div'> {}

export const DataListPagination: React.FC<IDataListPaginationProps> = (props) => {
    const { className, ...otherProps } = props;

    const {
        state,
        pageSize,
        currentPage,
        itemsCount = 0,
        childrenItemCount,
        handleLoadMore,
        entityLabel,
    } = useDataListContext();

    const { copy } = useOdsCoreContext();

    const currentlyDisplayed = Math.min(pageSize * (currentPage + 1), childrenItemCount);

    const hasMore = currentlyDisplayed < itemsCount;

    if (state === 'initialLoading' || state === 'error' || currentlyDisplayed === 0) {
        return null;
    }

    return (
        <div className={classNames('flex flex-row items-center justify-between gap-4 md:gap-6', className)} {...otherProps}>
            {hasMore && (
            <Button
                size="sm"
                responsiveSize={{ md: 'md' }}
                variant="tertiary"
                className="shrink-0"
                onClick={() => handleLoadMore(currentPage + 1)}
                isLoading={state === 'fetchingNextPage'}
            >
                {copy.dataListPagination.more}
            </Button>
            )}
            {itemsCount > 0 && (

                    <p className={classNames(
                      !hasMore && 'w-full',
                        "shrink-0 text-right text-base font-normal leading-tight text-neutral-500",
                    )}>
                        <span className="text-neutral-800">{currentlyDisplayed} </span>
                        <span>
                            {copy.dataListPagination.outOf({
                                total: itemsCount,
                                entityLabel,
                            })}
                        </span>
                    </p>
            )}
        </div>
    );
};
