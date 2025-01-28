import * as RadixDropdown from '@radix-ui/react-dropdown-menu';
import { type ComponentProps, type ReactNode } from 'react';
import { type IButtonProps } from '../../button';
export interface IDropdownContainerProps extends Omit<ComponentProps<'div'>, 'dir'> {
    /**
     * Size of the dropdown trigger.
     * @default lg
     */
    size?: IButtonProps['size'];
    /**
     * Custom dropdown trigger displayed instead of the default button.
     */
    customTrigger?: ReactNode;
    /**
     * Size of the dropdown trigger depending on the current breakpoint.
     */
    responsiveSize?: IButtonProps['responsiveSize'];
    /**
     * Label of the dropdown trigger.
     */
    label?: string;
    /**
     * Alignment of the dropdown content.
     * @default start
     */
    align?: RadixDropdown.DropdownMenuContentProps['align'];
    /**
     * Hides the dropdown trigger icon when set to true. This property has no effect when the label property
     * is not set or is empty.
     */
    hideIcon?: boolean;
    /**
     * Disables the dropdown when set to true.
     */
    disabled?: boolean;
    /**
     * Whether the dropdown is open by default.
     */
    defaultOpen?: boolean;
    /**
     * Whether the dropdown is open.
     */
    open?: boolean;
    /**
     * Callback when the open state changes.
     */
    onOpenChange?: (open: boolean) => void;
    /**
     * Sets a max width to the dropdown content as the remaining width between the trigger and the boundary edge.
     * @default true
     */
    constrainContentWidth?: boolean;
    /**
     * Sets a max height to the dropdown content as the remaining height between the trigger and the boundary edge.
     * @default true
     */
    constrainContentHeight?: boolean;
    /**
     * Additional classnames for the dropdown container (e.g. for setting a max width for the dropdown items).
     */
    contentClassNames?: string;
}
export declare const DropdownContainer: React.FC<IDropdownContainerProps>;
