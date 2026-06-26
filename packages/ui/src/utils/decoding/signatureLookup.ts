import { parseAbiItem, type AbiFunction, type Hex } from "viem";

type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<any> }>;

const ENDPOINT = "https://api.openchain.xyz/signature-database/v1/lookup";

export async function loadSignatureFrom(fetchImpl: FetchLike, selector: Hex): Promise<AbiFunction | null> {
  try {
    const res = await fetchImpl(`${ENDPOINT}?function=${selector}&filter=true`);
    if (!res.ok) return null;
    const json = await res.json();
    const candidates: Array<{ name: string }> | undefined = json?.result?.function?.[selector];
    const name = candidates?.[0]?.name;
    if (!name) return null;
    const item = parseAbiItem(`function ${name}`);
    return item.type === "function" ? (item as AbiFunction) : null;
  } catch {
    return null;
  }
}

export function loadSignature(selector: Hex): Promise<AbiFunction | null> {
  return loadSignatureFrom((url) => fetch(url), selector);
}
