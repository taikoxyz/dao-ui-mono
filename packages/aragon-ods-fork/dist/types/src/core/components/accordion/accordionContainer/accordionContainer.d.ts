import { type ComponentPropsWithRef } from 'react';
export type AccordionMultiValue<TMulti extends boolean> = TMulti extends true ? string[] | undefined : string | undefined;
export interface IAccordionContainerBaseProps<TMulti extends boolean> extends Omit<ComponentPropsWithRef<'div'>, 'dir'> {
    /**
     * Determines whether one or multiple items can be opened at the same time.
     */
    isMulti: TMulti;
    /**
     * The value of the item to expand when initially rendered and type is "single". Use when you do not need to control the state of the items.
     */
    defaultValue?: AccordionMultiValue<TMulti>;
    /**
     * Array of key values that determines which items are currently expanded.
     */
    value?: AccordionMultiValue<TMulti>;
    /**
     * When the current value (open section) changes, this function will be called.
     */
    onValueChange?: (value: AccordionMultiValue<TMulti>) => void;
}
export type IAccordionContainerProps = IAccordionContainerBaseProps<true> | IAccordionContainerBaseProps<false>;
export declare const AccordionContainer: import("react").ForwardRefExoticComponent<(Omit<IAccordionContainerBaseProps<true>, "ref"> | Omit<IAccordionContainerBaseProps<false>, "ref">) & import("react").RefAttributes<HTMLDivElement>>;
