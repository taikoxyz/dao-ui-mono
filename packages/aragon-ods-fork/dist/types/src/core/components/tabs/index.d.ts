export declare const Tabs: {
    Root: import("react").ForwardRefExoticComponent<import("./tabsRoot").ITabsRootProps & import("react").RefAttributes<HTMLDivElement>>;
    List: import("react").FC<import("./tabsList").ITabsListProps>;
    Trigger: import("react").FC<import("./tabsTrigger").ITabsTriggerProps>;
    Content: import("react").FC<import("./tabsContent").ITabsContentProps>;
};
export * from './tabsContent';
export * from './tabsList';
export * from './tabsRoot';
export * from './tabsTrigger';
