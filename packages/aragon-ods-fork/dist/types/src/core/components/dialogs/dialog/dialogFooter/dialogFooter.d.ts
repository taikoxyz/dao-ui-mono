import { type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ComponentPropsWithoutRef } from 'react';
import { type IAlertInlineProps } from '../../../alerts';
import { type IButtonBaseProps } from '../../../button';
export type IDialogFooterAction = (Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> | Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) & Pick<IButtonBaseProps, 'iconRight' | 'iconLeft'> & {
    /**
     * Button label
     */
    label: string;
};
export interface IDialogFooterProps extends ComponentPropsWithoutRef<'div'> {
    /**
     * Optional AlertInline
     */
    alert?: IAlertInlineProps;
    /**
     * Dialog primary action button
     */
    primaryAction?: IDialogFooterAction;
    /**
     * Dialog secondary action button
     */
    secondaryAction?: IDialogFooterAction;
}
/**
 * `Dialog.Footer` component
 */
export declare const DialogFooter: React.FC<IDialogFooterProps>;
