import { type ComponentProps } from 'react';
import { useIMask } from 'react-imask';
export interface IUseNumberMaskProps extends Pick<ComponentProps<'input'>, 'min' | 'max' | 'value'> {
    /**
     * Prefix for the number mask.
     */
    prefix?: string;
    /**
     * Suffix for the number mask.
     */
    suffix?: string;
    /**
     * Callback called on value change. Override the default onChange callback to only emit the updated value because
     * the library in use formats the user input and emit the valid number when valid.
     */
    onChange?: (value: string) => void;
}
export interface IUseNumberMaskResult extends ReturnType<typeof useIMask<HTMLInputElement>> {
}
export declare const useNumberMask: (props: IUseNumberMaskProps) => IUseNumberMaskResult;
