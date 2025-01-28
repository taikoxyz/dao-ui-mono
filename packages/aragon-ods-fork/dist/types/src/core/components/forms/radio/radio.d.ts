import { type ComponentProps } from 'react';
export interface IRadioProps extends ComponentProps<'button'> {
    /**
     * Radio label
     */
    label: string;
    /**
     * Indicates the position of the label
     * @default right
     */
    labelPosition?: 'left' | 'right';
    /**
     * The value of the radio item.
     */
    value: string;
    /**
     * Indicates if the radio is disabled.
     */
    disabled?: boolean;
}
export declare const Radio: import("react").ForwardRefExoticComponent<Omit<IRadioProps, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
