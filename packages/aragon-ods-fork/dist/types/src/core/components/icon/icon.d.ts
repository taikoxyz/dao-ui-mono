import type { SVGProps } from 'react';
import { type ResponsiveAttribute } from '../../types';
import type { IconType } from './iconType';
export type IconSize = 'sm' | 'md' | 'lg';
export interface IIconProps extends SVGProps<SVGSVGElement> {
    /**
     * Icon to be displayed.
     */
    icon: IconType;
    /**
     * Size of the icon.
     * @default md
     */
    size?: IconSize;
    /**
     * Size of the icon depending on the current breakpoint.
     */
    responsiveSize?: ResponsiveAttribute<IconSize>;
}
export declare const Icon: React.FC<IIconProps>;
