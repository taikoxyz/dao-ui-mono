import "dotenv/config";
import { createPublicClient, http, fromHex, isHex, isAddress, zeroAddress, type Address } from "viem";
import {
  PUB_CHAIN,
  PUB_DELEGATION_WALL_CONTRACT_ADDRESS,
  PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
  PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS,
  PUB_MULTISIG_PLUGIN_ADDRESS,
  PUB_WEB3_ENDPOINT,
} from "../constants";
import { DelegateAnnouncerAbi } from "../plugins/delegates/artifacts/DelegationWall.sol";
import { EmergencyMultisigPluginAbi } from "../plugins/emergency-multisig/artifacts/EmergencyMultisigPlugin";
import { MultisigPluginAbi } from "../plugins/multisig/artifacts/MultisigPlugin";
import { OptimisticTokenVotingPluginAbi } from "../plugins/optimistic-proposals/artifacts/OptimisticTokenVotingPlugin.sol";
import { getCachedIpfs, isRawSha256, parseIpfsPath, warmToCache } from "../server/ipfs/mirror";

/**
 * One-time, idempotent seed of the durable IPFS cache for proposals/announcements
 * that already exist on-chain (created before pin-time pre-warming shipped).
 *
 * Run once after the Blob store is connected (needs BLOB_READ_WRITE_TOKEN):
 *   bun run ipfs:seed
 *
 * Safe to re-run: content is keyed by CID, and anything already cached is skipped.
 */

const CONCURRENCY = 4;

const proposalPlugins = [
  { name: "multisig", address: PUB_MULTISIG_PLUGIN_ADDRESS, abi: MultisigPluginAbi },
  { name: "emergency-multisig", address: PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS, abi: EmergencyMultisigPluginAbi },
  { name: "dual-governance", address: PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS, abi: OptimisticTokenVotingPluginAbi },
] as const;

const client = createPublicClient({ chain: PUB_CHAIN, transport: http(PUB_WEB3_ENDPOINT || undefined) });

function usable(address: string): address is Address {
  return isAddress(address) && address.toLowerCase() !== zeroAddress;
}

function decodeIpfsUri(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (!isHex(value)) return value;
  try {
    return fromHex(value, "string");
  } catch {
    return null;
  }
}

// getProposal structs vary per plugin; pull the first field that decodes to an
// IPFS URI (the metadata / encryptedPayloadURI bytes).
function uriFromProposal(proposal: unknown): string | null {
  const values = Array.isArray(proposal)
    ? proposal
    : proposal && typeof proposal === "object"
      ? Object.values(proposal)
      : [];
  for (const value of values) {
    const uri = decodeIpfsUri(value);
    if (uri && (uri.startsWith("ipfs://") || /^(Qm|baf)/.test(uri))) return uri;
  }
  return null;
}

async function collectProposalUris(): Promise<string[]> {
  const uris: string[] = [];
  for (const plugin of proposalPlugins) {
    if (!usable(plugin.address)) continue;
    let count: bigint;
    try {
      count = (await client.readContract({
        address: plugin.address,
        abi: plugin.abi,
        functionName: "proposalCount",
      })) as bigint;
    } catch (err) {
      console.warn(`[${plugin.name}] proposalCount() failed: ${(err as Error).message.split("\n")[0]}`);
      continue;
    }
    console.info(`[${plugin.name}] ${count} proposal(s)`);
    for (let id = 0n; id < count; id++) {
      try {
        const proposal = await client.readContract({
          address: plugin.address,
          abi: plugin.abi,
          functionName: "getProposal",
          args: [id],
        });
        const uri = uriFromProposal(proposal);
        if (uri) uris.push(uri);
      } catch (err) {
        console.warn(`[${plugin.name}] getProposal(${id}) failed: ${(err as Error).message.split("\n")[0]}`);
      }
    }
  }
  return uris;
}

async function collectDelegateUris(): Promise<string[]> {
  if (!usable(PUB_DELEGATION_WALL_CONTRACT_ADDRESS)) return [];
  let addresses: readonly Address[];
  try {
    addresses = (await client.readContract({
      address: PUB_DELEGATION_WALL_CONTRACT_ADDRESS,
      abi: DelegateAnnouncerAbi,
      functionName: "getCandidateAddresses",
    })) as readonly Address[];
  } catch (err) {
    console.warn(`[delegates] getCandidateAddresses() failed: ${(err as Error).message.split("\n")[0]}`);
    return [];
  }
  console.info(`[delegates] ${addresses.length} announcement(s)`);
  const uris: string[] = [];
  for (const address of addresses) {
    try {
      const raw = await client.readContract({
        address: PUB_DELEGATION_WALL_CONTRACT_ADDRESS,
        abi: DelegateAnnouncerAbi,
        functionName: "candidates",
        args: [address],
      });
      const uri = decodeIpfsUri(raw);
      if (uri) uris.push(uri);
    } catch (err) {
      console.warn(`[delegates] candidates(${address}) failed: ${(err as Error).message.split("\n")[0]}`);
    }
  }
  return uris;
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function main() {
  const rawUris = [...(await collectProposalUris()), ...(await collectDelegateUris())];
  const unique = [...new Set(rawUris)];
  console.info(`\nDiscovered ${unique.length} unique IPFS reference(s). Seeding the durable cache…\n`);

  let warmed = 0;
  let alreadyCached = 0;
  let skippedNonRaw = 0;
  const failed: string[] = [];

  await mapLimit(unique, CONCURRENCY, async (uri) => {
    const parsed = parseIpfsPath(uri);
    if (!parsed || !isRawSha256(parsed)) {
      skippedNonRaw++;
      return;
    }
    try {
      if (await getCachedIpfs(parsed)) {
        alreadyCached++;
        return;
      }
      await warmToCache(parsed);
      warmed++;
      console.info(`  warmed ${parsed.rootCid}`);
    } catch (err) {
      failed.push(`${parsed.rootCid}: ${(err as Error).message.split("\n")[0]}`);
    }
  });

  console.info(
    `\nDone. warmed=${warmed} alreadyCached=${alreadyCached} skippedNonRaw=${skippedNonRaw} failed=${failed.length}`
  );
  if (failed.length) {
    console.error("Failed:");
    for (const line of failed) console.error(`  ${line}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
