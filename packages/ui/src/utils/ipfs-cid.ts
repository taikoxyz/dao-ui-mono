import { importer } from "ipfs-unixfs-importer";

// Match Pinata's documented CIDv1 file-import profile exactly. Files that fit
// in one chunk produce a raw CID; larger files produce a dag-pb root over raw
// leaves. Keeping this in one shared helper prevents pin-time cache checks and
// emergency-proposal commitments from disagreeing at the chunk boundary.
export async function getPinataFileCid(content: string | Uint8Array): Promise<string> {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  const sink: Parameters<typeof importer>[1] = {
    async put(cid) {
      return cid;
    },
  };

  let rootCid: string | undefined;
  for await (const entry of importer([{ content: bytes }], sink, { cidVersion: 1, rawLeaves: true })) {
    rootCid = entry.cid.toString();
  }
  if (!rootCid) throw new Error("UnixFS importer returned no CID");
  return rootCid;
}
