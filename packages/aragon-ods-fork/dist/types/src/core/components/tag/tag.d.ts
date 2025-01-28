export type TagVariant = 'neutral' | 'info' | 'warning' | 'critical' | 'success' | 'primary';
export interface ITagProps {
    /**
     * Defines the variant of the tag.
     * @default neutral
     */
    variant?: TagVariant;
    /**
     * Label of the tag.
     */
    label: string;
    /**
     * Classes for the component.
     */
    className?: string;
}
export declare const Tag: React.FC<ITagProps>;
