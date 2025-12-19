import { useEffect, useState } from "react";
import { EvmValue, RawAction } from "@/utils/types";
import { AbiFunction, Address, Hex, decodeFunctionData, toFunctionSelector } from "viem";
import { useAbi } from "./useAbi";
import { getFallbackAbiFunction } from "@/utils/fallback-abi";

export function useAction(action: RawAction) {
  const { abi, isLoading } = useAbi(action.to as Address);
  const [functionName, setFunctionName] = useState<string | null>(null);
  const [functionAbi, setFunctionAbi] = useState<AbiFunction | null>(null);
  const [actionArgs, setActionArgs] = useState<EvmValue[]>([]);

  useEffect(() => {
    if (!action.data || action.data === "0x") {
      return;
    }

    const hexSelector = action.data.slice(0, 10) as Hex;

    // First try to find in the fetched ABI
    let func = abi.find((item) => item.type === "function" && hexSelector === toFunctionSelector(item));

    // If not found, try the fallback ABI (don't wait for ABI loading to complete)
    if (!func) {
      const fallbackFunc = getFallbackAbiFunction(hexSelector);
      if (fallbackFunc) {
        func = fallbackFunc;
      }
    }

    if (!func || func.type !== "function") {
      // Reset state if no function found
      setFunctionAbi(null);
      setFunctionName(null);
      setActionArgs([]);
      return;
    }

    try {
      const { args, functionName } = decodeFunctionData({
        abi: [func],
        data: action.data as Hex,
      });
      setFunctionAbi(func);
      setFunctionName(functionName);
      setActionArgs((args as any as EvmValue[]) ?? []);
    } catch {
      // If decoding fails, reset state
      setFunctionAbi(null);
      setFunctionName(null);
      setActionArgs([]);
    }
  }, [action.data, action.to, isLoading, abi]);

  return {
    to: action.to,
    value: action.value,
    data: action.data,
    isLoading,
    functionName,
    functionAbi,
    args: actionArgs ?? [],
  };
}
