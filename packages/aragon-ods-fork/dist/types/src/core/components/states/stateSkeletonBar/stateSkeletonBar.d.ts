import { type CSSProperties, type ComponentPropsWithoutRef } from 'react';
import { type ResponsiveAttribute } from '../../../types';
export type StateSkeletonBarSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export interface IStateSkeletonBarProps extends ComponentPropsWithoutRef<'span'> {
    /**
     *  Responsive size attribute for the skeleton.
     */
    responsiveSize?: ResponsiveAttribute<StateSkeletonBarSize>;
    /**
     * The size of the skeleton.
     * @default 'md'
     */
    size?: StateSkeletonBarSize;
    /**
     * Specifies the width of the skeleton element.
     * Can be provided as a number (interpreted as pixels)
     * or a string with explicit units (e.g., px, %, em).
     * @default 160
     *
     * @example
     * width={200}    // Sets width to 200 pixels.
     * width="100px"  // Sets width to 100 pixels.
     * width="10%"    // Sets width to 10% of its parent container.
     */
    width?: CSSProperties['width'];
}
export declare const StateSkeletonBar: import("react").ForwardRefExoticComponent<IStateSkeletonBarProps & import("react").RefAttributes<HTMLDivElement>>;
