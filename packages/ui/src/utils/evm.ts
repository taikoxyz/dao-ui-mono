import { PUB_DEPLOYMENT_BLOCK } from "@/constants";
import { AbiEvent, Address, MaybeAbiEventName, MaybeExtractEventArgsFromAbi, PublicClient } from "viem";

const GET_LOGS_BLOCK_COUNT = 2000;

export const isAddress = (maybeAddress: any) => {
  if (!maybeAddress || typeof maybeAddress !== "string") return false;
  else if (!maybeAddress.match(/^0x[0-9a-fA-F]{40}$/)) return false;
  return true;
};

export function equalAddresses(value1?: string, value2?: string): boolean {
  if (!value1 || !value2) return false;
  else if (!isAddress(value1) || !isAddress(value2)) return false;
  return value1.toLowerCase().trim() === value2.toLocaleLowerCase().trim();
}

export function formatHexString(address: string | undefined): string {
  if (!address || address.length < 12) {
    return address ?? "";
  }

  // Take the first 5 characters (including '0x') and the last 4 characters
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

export function isContract(address: Address, publicClient: PublicClient) {
  if (!publicClient) return Promise.reject(new Error("Invalid client"));

  return publicClient.getCode({ address }).then((bytecode) => {
    return bytecode !== undefined && bytecode !== "0x";
  });
}

/**
 * Fetches every matching log emitted by `targetContract` between `fromBlock`
 * and the current head, paging through the range in fixed-size windows so no
 * single eth_getLogs call exceeds provider block-range limits.
 *
 * Windows are inclusive on both ends and never overlap: [from, from + N - 1],
 * then [from + N, from + 2N - 1], and so on, with the last window clamped to
 * the head observed at the start of the scan. Overlapping windows would
 * return the logs of every shared boundary block twice, which surfaced as
 * duplicated approvers/vetoers in the lists built from these events.
 *
 * @param targetContract
 * @param event
 * @param args
 * @param publicClient
 * @param fromBlock
 * @returns
 */
export async function getLogsUntilNow<T extends AbiEvent>(
  targetContract: Address,
  event: T,
  args: MaybeExtractEventArgsFromAbi<T extends AbiEvent ? [T] : undefined, MaybeAbiEventName<T>>,
  publicClient: PublicClient,
  fromBlock = PUB_DEPLOYMENT_BLOCK
) {
  let result: Awaited<ReturnType<typeof publicClient.getLogs<T>>> = [];
  const currentBlock = await publicClient.getBlockNumber();
  const windowSize = BigInt(GET_LOGS_BLOCK_COUNT);

  for (let windowStart = fromBlock; windowStart <= currentBlock; windowStart += windowSize) {
    const windowEnd = windowStart + windowSize - BigInt(1);

    const logs = await publicClient.getLogs<T>({
      address: targetContract,
      event,
      args,
      fromBlock: windowStart,
      toBlock: windowEnd < currentBlock ? windowEnd : currentBlock,
    });

    result = result.concat(logs);
  }

  return result;
}

export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
export const BYTES32_ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";
