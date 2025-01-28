import type { ComponentProps } from 'react';
export type ToggleGroupValue<TMulti extends boolean> = TMulti extends true ? string[] | undefined : string | undefined;
export interface IToggleGroupBaseProps<TMulti extends boolean> extends Omit<ComponentProps<'div'>, 'value' | 'onChange' | 'defaultValue' | 'ref' | 'dir'> {
    /**
     * Allows multiple toggles to be selected at the same time when set to true.
     */
    isMultiSelect: TMulti;
    /**
     * Current value of the toggle selection.
     */
    value?: ToggleGroupValue<TMulti>;
    /**
     * Default toggle selection.
     */
    defaultValue?: ToggleGroupValue<TMulti>;
    /**
     * Callback called on toggle selection change.
     */
    onChange?: (value: ToggleGroupValue<TMulti>) => void;
}
export type IToggleGroupProps = IToggleGroupBaseProps<true> | IToggleGroupBaseProps<false>;
export declare const ToggleGroup: (props: IToggleGroupProps) => import("react/jsx-runtime").JSX.Element;
