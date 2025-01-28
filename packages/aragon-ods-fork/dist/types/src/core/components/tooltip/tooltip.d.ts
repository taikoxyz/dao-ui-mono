import type React from 'react';
import { type ReactNode } from 'react';
export type TooltipVariant = 'neutral' | 'info' | 'warning' | 'critical' | 'success';
export interface ITooltipProps {
    /**
     * Content of the tooltip
     */
    content: ReactNode;
    /**
     * Defines the variant of the tooltip
     * @default neutral
     */
    variant?: TooltipVariant;
    /**
     * The open state of the tooltip when it is initially rendered. Use when you do not need to control its open state.
     */
    defaultOpen?: boolean;
    /**
     * The controlled open state of the tooltip. Must be used in conjunction with `onOpenChange`.
     */
    open?: boolean;
    /**
     * Event handler called when the open state of the tooltip changes.
     */
    onOpenChange?: (open: boolean) => void;
    /**
     * The duration from when the mouse enters the trigger until the tooltip opens.
     * @default 300
     */
    delayDuration?: number;
    /**
     * When `true`, hovering the content will keep the tooltip open.
     */
    disableHoverableContent?: boolean;
    /**
     * Additional class names for the tooltip content.
     */
    className?: string;
    /**
     * Children elements to trigger the tooltip.
     */
    children?: ReactNode;
}
export declare const Tooltip: React.FC<ITooltipProps>;
