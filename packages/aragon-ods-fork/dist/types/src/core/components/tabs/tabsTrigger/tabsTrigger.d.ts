import { type ComponentProps } from 'react';
import { type IconType } from '../../icon';
export interface ITabsTriggerProps extends ComponentProps<'button'> {
    /**
     * The label of the tab.
     */
    label: string;
    /**
     * Value linking Tabs.Trigger to its corresponding Tabs.Content
     */
    value: string;
    /**
     * The icon to display on the right side of the tab label.
     */
    iconRight?: IconType;
}
export declare const TabsTrigger: React.FC<ITabsTriggerProps>;
