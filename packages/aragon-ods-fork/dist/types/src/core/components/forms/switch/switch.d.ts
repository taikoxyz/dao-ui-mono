import { type IInputContainerBaseProps } from '../inputContainer';
export interface ISwitchProps extends Pick<IInputContainerBaseProps, 'alert' | 'label' | 'helpText' | 'isOptional'> {
    /**
     * Indicates whether the switch is checked
     */
    checked?: boolean;
    /**
     * CSS class name
     */
    className?: string;
    /**
     * The default checked state of the switch
     * @default false
     */
    defaultChecked?: boolean;
    /**
     * Indicates whether the switch is disabled
     * @default false
     */
    disabled?: boolean;
    /**
     * The ID of the switch
     */
    id?: string;
    /**
     * The inline label of the switch
     */
    inlineLabel?: string;
    /**
     * The name of the switch
     */
    name?: string;
    /**
     * Event handler for when the checked state changes
     * @param checked - The new checked state
     */
    onCheckedChanged?: (checked: boolean) => void;
}
export declare const Switch: React.FC<ISwitchProps>;
