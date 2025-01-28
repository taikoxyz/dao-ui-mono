import { type IInputContainerProps } from '../inputContainer';
export interface ITextAreaRichTextProps extends Omit<IInputContainerProps, 'maxLength' | 'inputLength' | 'value' | 'onChange' | 'id'> {
    /**
     * Current value of the input.
     */
    value?: string;
    /**
     * Id of the input.
     */
    id?: string;
    /**
     * Callback called on value change.
     */
    onChange?: (value: string) => void;
    /**
     * Placeholder of the input.
     */
    placeholder?: string;
    /**
     * Whether to render the editor on the first render or not.
     */
    immediatelyRender?: boolean;
}
export declare const TextAreaRichText: React.FC<ITextAreaRichTextProps>;
