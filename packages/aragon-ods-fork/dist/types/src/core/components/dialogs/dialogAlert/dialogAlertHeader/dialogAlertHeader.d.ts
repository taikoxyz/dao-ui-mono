import { type ComponentPropsWithoutRef } from 'react';
export interface IDialogAlertHeaderProps extends ComponentPropsWithoutRef<'div'> {
    /**
     * Title summarizing dialog's content or purpose.
     */
    title: string;
    /**
     * Optional visually hidden description announced when the dialog is opened for accessibility.
     */
    description?: string;
}
/**
 * `DialogAlert.Header` component
 *
 * **NOTE**: This component must be used inside a `<DialogAlert.Root />` component.
 */
export declare const DialogAlertHeader: React.FC<IDialogAlertHeaderProps>;
