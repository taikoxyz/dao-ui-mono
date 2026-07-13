import type { AbiParameter } from "viem";
import type { DecodedParam } from "./types";

/** Read a tuple field from viem's decode, whether it returned an object (named) or an array. */
function readField(value: unknown, name: string | undefined, index: number): unknown {
  if (Array.isArray(value)) return value[index];
  if (value && typeof value === "object" && name) return (value as Record<string, unknown>)[name];
  return undefined;
}

function buildParam(input: AbiParameter, value: unknown): DecodedParam {
  const base: DecodedParam = {
    name: input.name ?? "",
    type: input.type,
    value: value as DecodedParam["value"],
    internalType: (input as { internalType?: string }).internalType,
  };
  const components = (input as { components?: readonly AbiParameter[] }).components;
  if (input.type === "tuple" && components && components.length) {
    base.components = components.map((c, i) => buildParam(c, readField(value, c.name, i)));
  }
  return base;
}

/**
 * Map ABI inputs + decoded argument values to DecodedParams. Recurses `tuple`
 * types into `components` so struct fields render with names + types. Pure; never
 * throws (a shape mismatch just yields the flat param with undefined children).
 */
export function buildParams(inputs: readonly AbiParameter[], values: readonly unknown[]): DecodedParam[] {
  return inputs.map((inp, i) => buildParam(inp, values[i]));
}
