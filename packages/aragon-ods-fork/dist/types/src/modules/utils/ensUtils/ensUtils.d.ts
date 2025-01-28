declare class EnsUtils {
    private ensPattern;
    /**
     * Checks if the given value is a valid ENS name or not.
     * @param value The value to be checked.
     * @returns True when the given value is a valid ENS name, false otherwise.
     */
    isEnsName: (value?: string) => boolean;
    /**
     * Truncates the ENS name by displaying the first 5 characters and the eth suffix.
     * @param address The ENS name to truncate
     * @returns The truncated ENS name when the ens input is valid, the ENS input as is otherwise.
     */
    truncateEns: (ens?: string) => string;
}
export declare const ensUtils: EnsUtils;
export {};
