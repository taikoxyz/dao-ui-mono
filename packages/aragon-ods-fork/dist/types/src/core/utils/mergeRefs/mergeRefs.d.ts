import type { LegacyRef, MutableRefObject, RefCallback } from 'react';
/**
 * Utility to merge multiple React refs, inspired by https://github.com/gregberge/react-merge-refs
 */
export declare const mergeRefs: <T = unknown>(refs: Array<MutableRefObject<T> | LegacyRef<T> | undefined | null>) => RefCallback<T>;
