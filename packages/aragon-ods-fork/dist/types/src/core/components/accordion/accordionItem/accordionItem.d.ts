import { type ComponentPropsWithRef } from 'react';
export interface IAccordionItemProps extends ComponentPropsWithRef<'div'> {
    /**
     * A unique value of the accordion item which can matched for default open selection from the root container.
     */
    value: string;
    /**
     * Determines whether the accordion item is disabled.
     */
    disabled?: boolean;
}
export declare const AccordionItem: import("react").ForwardRefExoticComponent<Omit<IAccordionItemProps, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
