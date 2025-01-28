import type React from 'react';
import { type IAvatarProps } from '../../../../core';
import type { IWeb3ComponentProps } from '../../../types';
export interface IMemberAvatarProps extends Omit<IAvatarProps, 'fallback'>, IWeb3ComponentProps {
    /**
     * ENS name of the user to lookup avatar src.
     */
    ensName?: string;
    /**
     * 0x address of the user to look up ENS name and avatar src.
     */
    address?: string;
    /**
     * Direct URL src of the user avatar image to be rendered.
     */
    avatarSrc?: string;
}
export declare const MemberAvatar: React.FC<IMemberAvatarProps>;
