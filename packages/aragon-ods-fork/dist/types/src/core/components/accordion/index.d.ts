export declare const Accordion: {
    Container: import("react").ForwardRefExoticComponent<(Omit<import("./accordionContainer").IAccordionContainerBaseProps<true>, "ref"> | Omit<import("./accordionContainer").IAccordionContainerBaseProps<false>, "ref">) & import("react").RefAttributes<HTMLDivElement>>;
    Item: import("react").ForwardRefExoticComponent<Omit<import("./accordionItem").IAccordionItemProps, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
    ItemHeader: import("react").ForwardRefExoticComponent<Omit<import("./accordionItemHeader").IAccordionItemHeaderProps, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
    ItemContent: import("react").ForwardRefExoticComponent<Omit<import("./accordionItemContent").IAccordionItemContentProps, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
};
export * from './accordionContainer';
export * from './accordionItem';
export * from './accordionItemContent';
export * from './accordionItemHeader';
