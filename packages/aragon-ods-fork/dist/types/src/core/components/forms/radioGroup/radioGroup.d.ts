import { type ReactNode } from 'react';
import { type IInputContainerBaseProps } from '../inputContainer';
export interface IRadioGroupProps extends Pick<IInputContainerBaseProps, 'alert' | 'label' | 'helpText' | 'isOptional'> {
    /**
     * The value of the selected radio item.
     */
    value?: string;
    /**
     * The default value of the selected radio item.
     */
    defaultValue?: string;
    /**
     * Callback when the value changes.
     */
    onValueChange?: (value: string) => void;
    /**
     * The name of the radio group.
     */
    name?: string;
    /**
     * Whether the radio group is disabled.
     */
    disabled?: boolean;
    /**
     * Additional classes for the component.
     */
    className?: string;
    /**
     * Children of the component.
     */
    children?: ReactNode;
}
export declare const RadioGroup: import("react").ForwardRefExoticComponent<IRadioGroupProps & import("react").RefAttributes<HTMLDivElement>>;
