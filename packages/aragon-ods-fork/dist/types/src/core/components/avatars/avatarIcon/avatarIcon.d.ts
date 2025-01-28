import type React from 'react';
import { type HTMLAttributes } from 'react';
import { type ResponsiveAttribute } from '../../../types';
import { type IconType } from '../../icon';
export type AvatarIconSize = 'sm' | 'md' | 'lg';
export type AvatarIconVariant = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'critical';
export interface IAvatarIconProps extends HTMLAttributes<HTMLDivElement> {
    /**
     * The icon type.
     */
    icon: IconType;
    /**
     * Responsive size attribute for the avatar.
     */
    responsiveSize?: ResponsiveAttribute<AvatarIconSize>;
    /**
     * The size of the avatar icon.
     * @default sm
     */
    size?: AvatarIconSize;
    /**
     * The variant of the avatar.
     * @default neutral
     */
    variant?: AvatarIconVariant;
    /**
     * Renders the icon on a white background. This property overrides the variant default background.
     */
    backgroundWhite?: boolean;
}
export declare const AvatarIcon: React.FC<IAvatarIconProps>;
