import { type ICollapsibleProps } from '../../collapsible';
export interface ICardCollapsibleProps extends Omit<ICollapsibleProps, 'buttonVariant' | 'className'> {
    /**
     * Additional class names to apply to the card.
     */
    className?: string;
}
export declare const CardCollapsible: React.FC<ICardCollapsibleProps>;
