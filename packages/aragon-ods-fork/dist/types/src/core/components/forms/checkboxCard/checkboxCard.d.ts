import { type ComponentProps } from 'react';
import { type ITagProps } from '../../tag';
import { type CheckboxState } from '../checkbox/checkbox';
export interface ICheckboxCardProps extends ComponentProps<'button'> {
    /**
     * Avatar of the checkbox card.
     */
    avatar?: string;
    /**
     * Label of the checkbox.
     */
    label: string;
    /**
     * Description of the checkbox.
     */
    description: string;
    /**
     * Optional tag for the checkbox.
     */
    tag?: ITagProps;
    /**
     * The checked state of the checkbox.
     */
    checked?: CheckboxState;
    /**
     * Callback when the checked state changes.
     */
    onCheckedChange?: (checked: CheckboxState) => void;
    /**
     * Indicates if the checkbox is disabled.
     */
    disabled?: boolean;
    /**
     * Id of the checkbox.
     */
    id?: string;
}
export declare const CheckboxCard: import("react").ForwardRefExoticComponent<Omit<ICheckboxCardProps, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
