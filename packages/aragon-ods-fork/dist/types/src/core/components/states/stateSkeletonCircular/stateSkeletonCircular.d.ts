import { type ComponentPropsWithoutRef } from 'react';
import { type ResponsiveAttribute } from '../../../types';
export type StateSkeletonCircularSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export interface IStateSkeletonCircularProps extends ComponentPropsWithoutRef<'span'> {
    /**
     *  Responsive size attribute for the skeleton.
     */
    responsiveSize?: ResponsiveAttribute<StateSkeletonCircularSize>;
    /**
     * The size of the skeleton.
     * @default 'md'
     */
    size?: StateSkeletonCircularSize;
}
export declare const StateSkeletonCircular: import("react").ForwardRefExoticComponent<IStateSkeletonCircularProps & import("react").RefAttributes<HTMLDivElement>>;
