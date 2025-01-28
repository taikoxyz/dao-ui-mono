export interface IClipboardUtilsParams {
    /**
     * Callback called on paste error.
     */
    onError?: (error: unknown) => void;
}
declare class ClipboardUtils {
    copy: (value: string, params?: IClipboardUtilsParams) => Promise<void>;
    paste: (params?: IClipboardUtilsParams) => Promise<string>;
}
export declare const clipboardUtils: ClipboardUtils;
export {};
