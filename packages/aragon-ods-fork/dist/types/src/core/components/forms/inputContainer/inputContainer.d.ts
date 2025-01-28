import React from 'react';
import type { IInputContainerProps } from './inputContainer.api';
/**
 * The InputContainer component provides a consistent and shared styling foundation for various input components, such
 * as `InputText`, `InputNumber` and others. It also manages properties that are shared across all input components,
 * including `label`, `helpText` and more.
 */
export declare const InputContainer: React.ForwardRefExoticComponent<Omit<IInputContainerProps, "ref"> & React.RefAttributes<HTMLDivElement>>;
