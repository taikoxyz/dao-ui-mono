import { parseAbiItem, type AbiFunction, type Hex } from "viem";

type FetchLike = (url: string, init?: { signal: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<any> }>;

const ENDPOINT = "https://api.openchain.xyz/signature-database/v1/lookup";

// Hard ceiling on a single signature-DB lookup. A hung openchain.xyz response
// must not pin a decode open forever — on timeout we abort and return null.
const LOOKUP_TIMEOUT_MS = 8_000;

export async function loadSignatureFrom(
  fetchImpl: FetchLike,
  selector: Hex,
  timeoutMs: number = LOOKUP_TIMEOUT_MS,
): Promise<AbiFunction | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${ENDPOINT}?function=${selector}&filter=true`, { signal: controller.signal });
    if (!res.ok) return null;
    const json = await res.json();
    const candidates: Array<{ name: string }> | undefined = json?.result?.function?.[selector];
    const name = candidates?.[0]?.name;
    if (!name) return null;
    const item = parseAbiItem(`function ${name}`);
    return item.type === "function" ? (item as AbiFunction) : null;
  } catch {
    // network error, abort/timeout, or an unparseable signature → no decode
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function loadSignature(selector: Hex): Promise<AbiFunction | null> {
  return loadSignatureFrom((url, init) => fetch(url, init), selector);
}
