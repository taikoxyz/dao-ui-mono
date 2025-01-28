import type { ResponsiveAttribute, ResponsiveAttributeClassMap, ResponsiveSizeKey } from '../../types';
declare class ResponsiveUtils {
    generateClassNames<TSize extends ResponsiveSizeKey>(size: TSize, responsiveSize: ResponsiveAttribute<TSize> | undefined, classes: ResponsiveAttributeClassMap<TSize>): string;
}
export declare const responsiveUtils: ResponsiveUtils;
export {};
