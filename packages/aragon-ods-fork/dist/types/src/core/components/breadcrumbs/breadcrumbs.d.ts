import { type ITagProps } from '../tag';
export interface IBreadcrumbsLink {
    /**
     * Label to be displayed in the Breadcrumbs.
     */
    label: string;
    /**
     * Optional href to be used in the Link component for clickable navigation.
     */
    href?: string;
}
export interface IBreadcrumbsProps {
    /**
     * Array of BreadcrumbsLink objects `{label: string, href?: string}`
     * The array indicates depth from the current position to be displayed in the Breadcrumbs.
     * Starting at index 0 you must define the root up to the current location.
     * The final index which will render as non-active and without separator.
     */
    links: IBreadcrumbsLink[];
    /**
     * Optional tag pill to be displayed at the end of the Breadcrumbs for extra info. @type ITagProps
     */
    tag?: ITagProps;
}
export declare const Breadcrumbs: React.FC<IBreadcrumbsProps>;
