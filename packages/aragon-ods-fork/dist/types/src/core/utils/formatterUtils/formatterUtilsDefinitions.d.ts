import { type DateTimeFormatOptions } from 'luxon';
export type DynamicOptionFunction<TValue, TOptionValue> = (value: TValue) => TOptionValue | undefined;
export type DynamicOption<TValue = number, TOptionValue extends string | number | boolean = number> = TOptionValue | DynamicOptionFunction<TValue, TOptionValue>;
export interface INumberFormat {
    /**
     * Fixed fraction digits to use to format the number.
     */
    fixedFractionDigits?: DynamicOption;
    /**
     * Maximum fraction digits to use to format the number.
     */
    maxFractionDigits?: number;
    /**
     * Maximum number of significant digits displayed.
     */
    maxSignificantDigits?: DynamicOption;
    /**
     * Minimum fraction digits to use to format the number.
     */
    minFractionDigits?: number;
    /**
     * Uses the base symbol (K, M, B, T) when set to true.
     */
    useBaseSymbol?: boolean;
    /**
     * Format the number with the default currency when set to true.
     */
    isCurrency?: boolean;
    /**
     * Format the number as a percentage when set to true.
     */
    isPercentage?: boolean;
    /**
     * Always displays the number sign on the formatted number when set to true.
     */
    withSign?: boolean;
    /**
     * Fallback to display in case the value is null.
     */
    fallback?: string;
    /**
     * Displays the specified fallback when this function returns true, by default the formatter will display
     * the fallback when the value is NaN.
     */
    displayFallback?: (value: number) => boolean;
}
export declare enum NumberFormat {
    GENERIC_SHORT = "GENERIC_SHORT",
    GENERIC_LONG = "GENERIC_LONG",
    FIAT_TOTAL_SHORT = "FIAT_TOTAL_SHORT",
    FIAT_TOTAL_LONG = "FIAT_TOTAL_LONG",
    TOKEN_AMOUNT_SHORT = "TOKEN_AMOUNT_SHORT",
    TOKEN_AMOUNT_LONG = "TOKEN_AMOUNT_LONG",
    TOKEN_PRICE = "TOKEN_PRICE",
    PERCENTAGE_SHORT = "PERCENTAGE_SHORT",
    PERCENTAGE_LONG = "PERCENTAGE_LONG"
}
export declare const numberFormats: Record<NumberFormat, INumberFormat>;
export declare enum DateFormat {
    YEAR_MONTH_DAY_TIME = "YEAR_MONTH_DAY_TIME",
    YEAR_MONTH_DAY = "YEAR_MONTH_DAY",
    YEAR_MONTH = "YEAR_MONTH",
    DURATION = "DURATION",
    RELATIVE = "RELATIVE"
}
export interface IDateFormat extends DateTimeFormatOptions {
    /**
     * Formats the date as relative calendar (yesterday, today, tomorrow, ..) when set to true. The date is formatted
     * to a relative date only when the specified date is either yesterday, today or tomorrow. When the option is set
     * to "with-time", the time is also added to the relative date.
     */
    useRelativeCalendar?: 'default' | 'with-time';
    /**
     * Formats the date as relative (1 day ago, in 2 days, 2 hours ago, ..) when set to true.
     */
    useRelativeDate?: boolean;
    /**
     * Returns the absolute date diff using the biggest unit greater than 1 (1 day, 7 hours, 22 seconds) when set to true.
     */
    isDuration?: boolean;
}
export declare const dateFormats: Record<DateFormat, IDateFormat>;
