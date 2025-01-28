import { type ComponentProps } from 'react';
export type CheckboxState = boolean | 'indeterminate';
export interface ICheckboxProps extends ComponentProps<'button'> {
    /**
     * Label of the checkbox.
     */
    label: string;
    /**
     * Position of the label.
     * @default right
     */
    labelPosition?: 'right' | 'left';
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
export declare const Checkbox: import("react").ForwardRefExoticComponent<Omit<ICheckboxProps, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
