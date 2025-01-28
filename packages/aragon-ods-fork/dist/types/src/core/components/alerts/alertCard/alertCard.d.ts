import type React from 'react';
import { type HTMLAttributes, type ReactNode } from 'react';
import { type AlertVariant } from '../alertUtils';
export interface IAlertCardProps extends HTMLAttributes<HTMLDivElement> {
    /**
     * The alert message.
     */
    message: string;
    /**
     * Optional description for the alert.
     */
    description?: ReactNode;
    /**
     * Variant of the alert.
     * @default info
     */
    variant?: AlertVariant;
}
/**
 * AlertCard Component
 *
 * Displays an alert card with an icon, a main message, and an optional description.
 *
 * @param {IAlertCardProps} props - Component properties.
 * @returns {React.ReactElement} Rendered AlertCard component.
 */
export declare const AlertCard: React.FC<IAlertCardProps>;
