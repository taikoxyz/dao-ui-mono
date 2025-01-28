import type React from 'react';
import { type HTMLAttributes } from 'react';
import { type AlertVariant } from '../alertUtils';
export interface IAlertInlineProps extends HTMLAttributes<HTMLDivElement> {
    /**
     * Alert text content.
     */
    message: string;
    /**
     * Defines the variant of the alert.
     * @default info
     */
    variant?: AlertVariant;
}
/** AlertInline UI Component */
export declare const AlertInline: React.FC<IAlertInlineProps>;
