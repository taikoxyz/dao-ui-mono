import { type HTMLAttributes } from 'react';
import type { ResponsiveAttribute } from '../../types';
export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'neutral' | 'primary' | 'primaryInverted' | 'success' | 'warning' | 'critical';
export interface ISpinnerProps extends HTMLAttributes<HTMLDivElement> {
    /**
     * Size of the spinner.
     * @default md
     */
    size?: SpinnerSize;
    /**
     * Size of the spinner depending on the current breakpoint.
     */
    responsiveSize?: ResponsiveAttribute<SpinnerSize>;
    /**
     * Variant of the spinner.
     * @default neutral
     */
    variant?: SpinnerVariant;
}
/**
 * Spinner UI component
 */
export declare const Spinner: React.FC<ISpinnerProps>;
