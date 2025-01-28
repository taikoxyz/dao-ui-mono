import { Tabs as RadixTabsRoot } from '@radix-ui/react-tabs';
import { type ComponentPropsWithoutRef } from 'react';
export interface ITabsRootProps extends ComponentPropsWithoutRef<typeof RadixTabsRoot> {
    /**
     * The value of the tab that should be selected by default.
     */
    defaultValue?: string;
    /**
     * The value of the selected tab.
     */
    value?: string;
    /**
     * Callback when the value changes.
     */
    onValueChange?: (value: string) => void;
    /**
     * Whether the Tabs.List should use an underlined style. @default false
     */
    isUnderlined?: boolean;
}
export interface ITabsContext {
    /**
     * Whether the tabs share a common underline style implementation via the Tabs.List.
     */
    isUnderlined: boolean;
}
export declare const TabsContext: import("react").Context<ITabsContext>;
export declare const TabsRoot: import("react").ForwardRefExoticComponent<ITabsRootProps & import("react").RefAttributes<HTMLDivElement>>;
