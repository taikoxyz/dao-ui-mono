import type React from 'react';
import { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { type ResponsiveAttribute } from '../../../types';
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export interface IAvatarProps extends ComponentPropsWithoutRef<'img'> {
    /**
     *  Fallback content to display when the image fails to load or no image is provided.
     */
    fallback?: ReactNode;
    /**
     *  Responsive size attribute for the avatar.
     */
    responsiveSize?: ResponsiveAttribute<AvatarSize>;
    /**
     * The size of the avatar.
     * @default sm
     */
    size?: AvatarSize;
}
/**
 * Avatar component
 */
export declare const Avatar: React.FC<IAvatarProps>;
