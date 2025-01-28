export declare class DialogUtils {
    static readonly overlayAnimationVariants: {
        closed: {
            opacity: number;
        };
        open: {
            opacity: number;
        };
    };
    static readonly contentAnimationVariants: {
        closed: {
            opacity: number;
            scale: number;
            y: number;
        };
        open: {
            opacity: number;
            scale: number;
            y: number;
            transition: {
                duration: number;
            };
        };
        exit: {
            opacity: number;
            transition: {
                duration: number;
            };
        };
    };
}
