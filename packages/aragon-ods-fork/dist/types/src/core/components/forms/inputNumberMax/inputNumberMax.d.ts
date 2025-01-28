import { type IUseNumberMaskProps } from '../hooks';
import { type IInputComponentProps } from '../inputContainer';
export interface IInputNumberMaxProps extends Omit<IInputComponentProps, 'maxLength' | 'onChange'> {
    /**
     * Maximum number set on max button click.
     */
    max: number;
    /**
     * @see IUseNumberMaskProps['onChange']
     */
    onChange?: IUseNumberMaskProps['onChange'];
}
export declare const InputNumberMax: React.FC<IInputNumberMaxProps>;
