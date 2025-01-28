import type { ReactNode } from 'react';
import { type IInputContainerBaseProps } from '../inputContainer';
export interface ICheckboxGroupProps extends Pick<IInputContainerBaseProps, 'alert' | 'label' | 'helpText' | 'isOptional'> {
    /**
     * Additional classes for the component.
     */
    className?: string;
    /**
     * Children of the component.
     */
    children?: ReactNode;
}
export declare const CheckboxGroup: React.FC<ICheckboxGroupProps>;
