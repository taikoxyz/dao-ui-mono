import { type ComponentProps } from 'react';
export interface ITabsContentProps extends ComponentProps<'div'> {
    /**
     * Value linking Tabs.Content to its corresponding Tabs.Trigger
     */
    value: string;
    /**
     * When `true`, the content will stay mounted even when inactive.
     */
    forceMount?: true;
}
export declare const TabsContent: React.FC<ITabsContentProps>;
