import classNames from 'classnames';
import type { ComponentProps } from 'react';
import { Button } from '../../button';
import { Progress } from '../../progress';
import { useOdsCoreContext } from '../../odsCoreProvider';
import { useDataListContext } from '../dataListContext';

export interface IDataListPaginationProps extends ComponentProps<'div'> {}

export const DataListPagination: React.FC<IDataListPaginationProps> = (props) => {
    const { className, ...otherProps } = props;

    const { state, pageSize, currentPage, itemsCount, childrenItemCount, handleLoadMore, entityLabel } =
        useDataListContext();

    const { copy } = useOdsCoreContext();

    const resolvedItemsCount = itemsCount ?? childrenItemCount;
    const currentlyDisplayed = Math.min(pageSize * (currentPage + 1), childrenItemCount);

    const hasMore = currentlyDisplayed < resolvedItemsCount;
    const progressValue =
        itemsCount != null && itemsCount > 0 ? Math.round((currentlyDisplayed / itemsCount) * 100) : null;
    const shouldShowButton = state !== 'initialLoading' && state !== 'error' && currentlyDisplayed > 0;
    const isButtonDisabled = !hasMore || state === 'fetchingNextPage';

    if (state === 'initialLoading' || state === 'error' || currentlyDisplayed === 0) {
        return null;
    }

    return (
        <div
            className={classNames('flex flex-row items-center justify-between gap-4 md:gap-6', className)}
            {...otherProps}
        >
            {shouldShowButton && (
            <Button
                size="sm"
                responsiveSize={{ md: 'md' }}
                variant="tertiary"
                className="shrink-0"
                onClick={() => handleLoadMore(currentPage + 1)}
                isLoading={state === 'fetchingNextPage'}
                disabled={isButtonDisabled}
            >
                {copy.dataListPagination.more}
            </Button>
            )}
            {itemsCount != null && itemsCount > 0 && (

                    <>
                        <Progress value={progressValue ?? 0} className="hidden w-32 shrink-0 md:block" />
                        <p
                            className={classNames(
                                !hasMore && 'w-full',
                                'shrink-0 text-right text-base font-normal leading-tight text-neutral-500',
                            )}
                        >
                            <span className="text-neutral-800">{currentlyDisplayed} </span>
                            <span>
                                {copy.dataListPagination.outOf({
                                    total: itemsCount,
                                    entityLabel,
                                })}
                            </span>
                        </p>
                    </>
            )}
        </div>
    );
};
