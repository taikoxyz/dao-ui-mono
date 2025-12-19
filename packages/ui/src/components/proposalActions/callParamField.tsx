import { InputText } from "@aragon/ods";
import { toFunctionSignature, type AbiFunction } from "viem";
import { resolveFieldTitle, type CallParameterFieldType } from "@/utils/abi-helpers";
import { ParamDisplay } from "./paramDisplay";

interface ICallParamFiledProps {
  value: CallParameterFieldType;
  idx: number;
  functionAbi: AbiFunction | null;
}
interface ICallFunctionSignatureFieldProps {
  functionAbi: AbiFunction | null;
}

export const CallParamField: React.FC<ICallParamFiledProps> = ({ value, idx, functionAbi }) => {
  if (functionAbi?.type !== "function") return null;

  const abiParam = functionAbi.inputs?.[idx];
  const label = resolveFieldTitle(abiParam?.name ?? "", abiParam?.type, idx);

  return <ParamDisplay value={value} abiParam={abiParam} label={label} />;
};

export const CallFunctionSignatureField: React.FC<ICallFunctionSignatureFieldProps> = ({ functionAbi }) => {
  if (functionAbi?.type !== "function") return null;

  const sig = toFunctionSignature(functionAbi);

  return <InputText label="Contract function" className="w-full" value={sig} disabled={true} />;
};
