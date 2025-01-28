export type HeadingSize = 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
export interface IHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
    /**
     * Specifies the semantic level of the heading, affecting both the HTML element used (e.g., <h1>, <h2>) and its default styling.
     * If the 'as' prop is not provided, this value determines the HTML element rendered in the DOM.
     * @default h1
     */
    size?: HeadingSize;
    /**
     * Optionally overrides the HTML element type that is rendered in the DOM, independent of the heading's semantic level determined by the 'size' prop.
     * This allows for styling and semantic adjustments where necessary.
     */
    as?: HeadingSize;
}
export declare const Heading: import("react").ForwardRefExoticComponent<IHeadingProps & import("react").RefAttributes<HTMLHeadingElement>>;
