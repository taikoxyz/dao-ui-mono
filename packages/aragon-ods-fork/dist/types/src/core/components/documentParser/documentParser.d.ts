import { type ComponentPropsWithoutRef } from 'react';
export interface IDocumentParserProps extends ComponentPropsWithoutRef<'div'> {
    /**
     * The stringified document of Markdown or HTML to parse into a styled output.
     */
    document: string;
}
export declare const DocumentParser: React.FC<IDocumentParserProps>;
