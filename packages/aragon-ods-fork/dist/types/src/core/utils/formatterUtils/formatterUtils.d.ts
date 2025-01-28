import { DateTime } from 'luxon';
import { DateFormat, NumberFormat, type INumberFormat } from './formatterUtilsDefinitions';
export interface IFormatNumberOptions extends INumberFormat {
    /**
     * Number format to use.
     * @default GENERIC_LONG
     */
    format?: NumberFormat;
}
export interface IFormatDateOptions {
    /**
     * Date format to use.
     * @default YEAR_MONTH_DAY_TIME
     */
    format?: DateFormat;
}
declare class FormatterUtils {
    numberLocale: string;
    dateLocale: string;
    currencyLocale: string;
    private baseSymbolRanges;
    private relativeDateOrder;
    formatNumber: (value: number | string | null | undefined, options?: IFormatNumberOptions) => string | null;
    formatDate: (value: DateTime | number | string | undefined, options?: IFormatDateOptions) => string | null;
    private isYesterdayTodayTomorrow;
    private getDateLiteral;
    private getDynamicOption;
    private getDecimalPlaces;
    private significantDigitsToFractionDigits;
}
export declare const formatterUtils: FormatterUtils;
export {};
