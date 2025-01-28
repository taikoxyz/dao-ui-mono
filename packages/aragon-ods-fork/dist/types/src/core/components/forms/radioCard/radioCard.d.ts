import { type ComponentProps } from 'react';
import { type ITagProps } from '../../tag';
export interface IRadioCardProps extends ComponentProps<'button'> {
    /**
     * Radio card avatar image source
     */
    avatar?: string;
    /**
     * Description
     */
    description: string;
    /**
     * Radio label
     */
    label: string;
    /**
     * Radio card tag
     */
    tag?: ITagProps;
    /**
     * The value of the radio item.
     */
    value: string;
    /**
     * Indicates if the radio is disabled.
     */
    disabled?: boolean;
}
export declare const RadioCard: import("react").ForwardRefExoticComponent<Omit<IRadioCardProps, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
