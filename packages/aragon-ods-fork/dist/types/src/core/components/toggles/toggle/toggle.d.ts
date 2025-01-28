import type { ComponentProps } from 'react';
export interface IToggleProps extends Omit<ComponentProps<'button'>, 'ref'> {
    /**
     * Value of the toggle.
     */
    value: string;
    /**
     * Label of the toggle.
     */
    label: string;
}
/**
 * The Toggle component is a button that handles the "on" and "off" states.
 *
 * **NOTE**: The component must be used inside a `<ToggleGroup />` component in order to work properly.
 */
export declare const Toggle: React.FC<IToggleProps>;
