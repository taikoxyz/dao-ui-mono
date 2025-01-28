import { type IInputComponentProps } from '../inputContainer';
export interface IInputDateProps extends Omit<IInputComponentProps, 'maxLength'> {
}
export declare const InputDate: React.FC<IInputDateProps>;
