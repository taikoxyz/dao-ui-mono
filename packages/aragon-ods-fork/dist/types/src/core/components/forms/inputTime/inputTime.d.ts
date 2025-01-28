import { type IInputComponentProps } from '../inputContainer';
export interface IInputTimeProps extends Omit<IInputComponentProps, 'maxLength' | 'inputLength'> {
}
export declare const InputTime: import("react").ForwardRefExoticComponent<IInputTimeProps & import("react").RefAttributes<HTMLInputElement>>;
