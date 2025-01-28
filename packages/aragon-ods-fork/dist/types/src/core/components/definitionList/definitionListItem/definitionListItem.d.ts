import { type ComponentPropsWithRef } from 'react';
export interface IDefinitionListItemProps extends ComponentPropsWithRef<'div'> {
    /**
     * The term to be displayed in the definition list item.
     */
    term: string;
}
export declare const DefinitionListItem: React.FC<IDefinitionListItemProps>;
