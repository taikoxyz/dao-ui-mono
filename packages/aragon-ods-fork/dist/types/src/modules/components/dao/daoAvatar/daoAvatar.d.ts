import type React from 'react';
import { type AvatarSize, type IAvatarProps } from '../../../../core';
export interface IDaoAvatarProps extends Omit<IAvatarProps, 'fallback'> {
    /**
     * Name of the DAO
     */
    name?: string;
    /**
     * The size of the avatar.
     * @default lg
     */
    size?: AvatarSize;
}
export declare const DaoAvatar: React.FC<IDaoAvatarProps>;
