/**
 * Object representing the structure of copy texts used in various parts of the ODS Core package.
 * Each property in the object corresponds to a specific component or feature, containing the necessary
 * text labels or functions that return text strings.
 */
export declare const coreCopy: {
    inputContainer: {
        optionalLabel: string;
    };
    dataListFilter: {
        filter: string;
        sort: string;
        reset: string;
    };
    dataListFilterStatus: {
        found: string;
        loadingEntity: (entityLabel: string) => string;
        filteringEntity: (entityLabel: string) => string;
    };
    dataListPagination: {
        more: string;
        outOf: ({ total, entityLabel }: {
            total: number;
            entityLabel: string;
        }) => string;
    };
    inputNumberMax: {
        max: string;
    };
};
export type CoreCopy = typeof coreCopy;
