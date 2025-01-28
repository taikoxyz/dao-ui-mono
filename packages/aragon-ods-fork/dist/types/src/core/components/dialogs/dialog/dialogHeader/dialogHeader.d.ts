import { type ComponentPropsWithoutRef } from 'react';
export interface IDialogHeaderProps extends ComponentPropsWithoutRef<'div'> {
    /**
     * Optional accessible description announced when the dialog is opened
     */
    description?: string;
    /**
     * Indicates whether a back button should be shown
     * @default false
     */
    showBackButton?: boolean;
    /**
     * Accessible title summarizing dialog's content or purpose. Will be announced when
     * dialog is opened.
     */
    title: string;
    /**
     * Callback invoked when the back button is clicked
     */
    onBackClick?: () => void;
    /**
     * Callback invoked when the close button is clicked. Closes the dialog by default
     */
    onCloseClick?: () => void;
}
/**
 * `Dialog.Header` component
 *
 * **NOTE**: This component must be used inside a `<Dialog.Root />` component.
 */
export declare const DialogHeader: React.FC<IDialogHeaderProps>;
