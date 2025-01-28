import { type IInputComponentProps } from '../../../../core';
import type { IWeb3ComponentProps } from '../../../types';
export interface IAddressInputResolvedValue {
    /**
     * Address value.
     */
    address?: string;
    /**
     * ENS name linked to the given address.
     */
    name?: string;
}
export interface IAddressInputProps extends Omit<IInputComponentProps<HTMLTextAreaElement>, 'maxLength' | 'value' | 'onChange'>, IWeb3ComponentProps {
    /**
     * Current value of the address input.
     */
    value?: string;
    /**
     * Callback called whenever the current input value (address or ens) changes.
     */
    onChange?: (value?: string) => void;
    /**
     * Callback called with the address value object when the user input is valid. The component will output the address
     * in checksum format and the ENS name normalised. The value will be set to undefined when the user input is not a
     * valid address nor a valid ens name.
     */
    onAccept?: (value?: IAddressInputResolvedValue) => void;
}
export declare const AddressInput: import("react").ForwardRefExoticComponent<IAddressInputProps & import("react").RefAttributes<HTMLTextAreaElement>>;
