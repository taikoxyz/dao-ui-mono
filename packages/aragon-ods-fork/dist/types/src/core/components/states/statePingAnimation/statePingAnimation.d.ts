import type React from 'react';
import { type ComponentPropsWithoutRef } from 'react';
export type StatePingAnimationVariant = 'primary' | 'info' | 'success' | 'warning' | 'critical';
export interface IStatePingAnimationProps extends ComponentPropsWithoutRef<'span'> {
    /**
     * Variant of the ping animation
     * @default primary
     */
    variant?: StatePingAnimationVariant;
}
export declare const StatePingAnimation: React.FC<IStatePingAnimationProps>;
