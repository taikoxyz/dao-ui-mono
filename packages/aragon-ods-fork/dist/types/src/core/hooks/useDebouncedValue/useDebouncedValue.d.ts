export interface IUseDebouncedValueParams {
    /**
     * Debounce time period in milliseconds.
     * @default 500
     */
    delay?: number;
}
export type IUseDebouncedValueResult<TValue> = [
    /**
     * Debounced value.
     */
    TValue,
    /**
     * Setter for the debounced value.
     */
    (value: TValue) => void
];
export declare const useDebouncedValue: <TValue>(value: TValue, params?: IUseDebouncedValueParams) => IUseDebouncedValueResult<TValue>;
