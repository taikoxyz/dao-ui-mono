import React, { type ComponentProps } from 'react';
import { IconType } from '../../icon';
export interface IDropdownItemProps extends Omit<ComponentProps<'div'>, 'onSelect'> {
    /**
     * Renders the dropdown item as selected when set to true.
     */
    selected?: boolean;
    /**
     * Icon displayed beside the item label. Defaults to LinkExternal when the item is a link or to Checkmark when the
     * selected property is set to true.
     */
    icon?: IconType;
    /**
     * Position of the icon.
     * @default right
     */
    iconPosition?: 'right' | 'left';
    /**
     * Link of the dropdown item.
     */
    href?: string;
    /**
     * Target of the dropdown link.
     */
    target?: string;
    /**
     * Rel attribute of the dropdown link.
     */
    rel?: string;
    /**
     * Disables the dropdown item when set to true.
     */
    disabled?: boolean;
    /**
     * Callback when the dropdown item is selected.
     */
    onSelect?: (event: Event) => void;
}
export declare const DropdownItem: React.FC<IDropdownItemProps>;
