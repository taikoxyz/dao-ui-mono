declare class TestLogger {
    private shouldSuppressErrors;
    private originalConsoleError;
    private testErrorLogger;
    setup: () => void;
    suppressErrors: () => void;
}
export declare const testLogger: TestLogger;
export {};
