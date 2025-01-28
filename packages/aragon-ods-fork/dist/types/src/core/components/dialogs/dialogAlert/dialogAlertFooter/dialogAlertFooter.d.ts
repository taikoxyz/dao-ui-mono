import type React from 'react';
import { type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import { type IButtonBaseProps } from '../../../button';
export type IDialogAlertFooterAction = (Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> | Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) & Pick<IButtonBaseProps, 'iconRight' | 'iconLeft'> & {
    /**
     * Button label
     */
    label: string;
};
export interface IDialogAlertFooterProps {
    /**
     * Alert dialog primary action button
     */
    actionButton: IDialogAlertFooterAction;
    /**
     * Alert dialog secondary button used for dismissing the dialog
     * or cancelling the action
     */
    cancelButton: IDialogAlertFooterAction;
}
/**
 * `DialogAlert.Footer` component
 *
 * **NOTE**: This component must be used inside a `<DialogAlert.Root />` component.
 */
export declare const DialogAlertFooter: React.FC<IDialogAlertFooterProps>;
