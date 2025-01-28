import { type IInputComponentProps } from '../inputContainer';
export interface IInputSearchProps extends IInputComponentProps {
    /**
     * Displays a loading indicator when set to true.
     */
    isLoading?: boolean;
}
export declare const InputSearch: import("react").ForwardRefExoticComponent<IInputSearchProps & import("react").RefAttributes<HTMLInputElement>>;
