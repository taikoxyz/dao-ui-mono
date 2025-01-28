import { type InputHTMLAttributes } from 'react';
import type { IInputComponentProps, IInputContainerProps, InputComponentElement } from '../inputContainer';
export interface IUseInputPropsResult<TElement extends InputComponentElement> {
    /**
     * Properties for the InputContainer component.
     */
    containerProps: IInputContainerProps;
    /**
     * Properties for the input element.
     */
    inputProps: InputHTMLAttributes<TElement>;
}
/**
 * Processes the InputComponent properties object to split it into container-specific and input-element-specific properties.
 * @param props The InputComponent properties
 * @returns The InputContainer and input element properties.
 */
export declare const useInputProps: <TElement extends InputComponentElement>(props: IInputComponentProps<TElement>) => IUseInputPropsResult<TElement>;
