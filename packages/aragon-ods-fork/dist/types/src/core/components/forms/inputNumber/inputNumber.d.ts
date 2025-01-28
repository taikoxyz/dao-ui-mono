import type React from 'react';
import { type IUseNumberMaskProps } from '../hooks';
import { type IInputComponentProps } from '../inputContainer';
export interface IInputNumberProps extends Omit<IInputComponentProps, 'onChange' | 'step' | 'min' | 'max' | 'maxLength'> {
    /**
     * The minimum value that the number input accepts.
     * @default Number.MIN_SAFE_INTEGER
     */
    min?: number;
    /**
     * The maximum value that the number input accepts.
     * @default Number.MAX_SAFE_INTEGER
     */
    max?: number;
    /**
     * Optional string prepended to the input value.
     */
    prefix?: string;
    /**
     * Specifies the granularity of the intervals for the input value.
     * @default 1
     */
    step?: number;
    /**
     * Optional string appended to the input value.
     */
    suffix?: string;
    /**
     * @see IUseNumberMaskProps['onChange']
     */
    onChange?: IUseNumberMaskProps['onChange'];
}
export declare const InputNumber: React.ForwardRefExoticComponent<IInputNumberProps & React.RefAttributes<HTMLInputElement>>;
