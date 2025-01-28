import { type ReactNode } from 'react';
import { type CoreCopy } from '../../assets';
export interface IOdsCoreContext {
    /**
     * Image component to be used for images.
     * @default 'img'
     */
    Img: React.FC | 'img';
    /**
     * Link component to be used for links.
     * @default 'a'
     */
    Link: React.FC | 'a';
    /**
     * Copy for the core components.
     */
    copy: CoreCopy;
}
export interface IOdsCoreProviderProps {
    /**
     * Context provider values.
     */
    values?: Partial<IOdsCoreContext>;
    /**
     * Children of the context provider.
     */
    children?: ReactNode;
}
export declare const OdsCoreProvider: React.FC<IOdsCoreProviderProps>;
export declare const useOdsCoreContext: () => Required<IOdsCoreContext>;
