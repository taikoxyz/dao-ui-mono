import { CID } from "multiformats/cid";
import { equals as bytesEqual } from "multiformats/bytes";
import * as rawCodec from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import { head, put } from "@vercel/blob";

// Public gateways raced on a cold miss. Pinata's own gateway is first: it has
// every proposal's metadata pinned, so it resolves fast. The CID is only ever
// appended as a path to one of these hardcoded hosts — never a user-supplied
// host (SSRF-safe).
const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs",
  "https://ipfs.io/ipfs",
  "https://dweb.link/ipfs",
  "https://w3s.link/ipfs",
];

// CIDs are content hashes, so the bytes can never change — caching forever is
// correct, not a gamble. This header lets Vercel's CDN serve repeat reads from
// the edge without invoking the function or touching Blob.
export const IMMUTABLE_CACHE = "public, s-maxage=31536000, max-age=31536000, immutable";

const NO_EXECUTE_CSP = "default-src 'none'; sandbox;";
const BLOB_PREFIX = "ipfs-cache/v1";
const GATEWAY_TIMEOUT = 20_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const BLOB_CACHE_MAX_AGE = 31_536_000;

// Content types we serve inline. Everything else collapses to a non-renderable
// octet-stream download so third-party IPFS bytes can never execute from our
// origin. (octet-stream is deliberately NOT here: it always force-downloads.)
const SAFE_INLINE_TYPES = new Set([
  "application/json",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export type ParsedIpfsPath = {
  cid: CID;
  rootCid: string;
  cidPath: string;
  hasSubpath: boolean;
};

export type CachedObject = {
  body: Buffer;
  contentType: string;
};

// ---------------------------------------------------------------------------
// Storage: Vercel Blob in production, an in-memory map in tests.
// ---------------------------------------------------------------------------

type Storage = {
  get(key: string): Promise<CachedObject | null>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
};

let storageOverride: Storage | null = null;

export function setIpfsCacheStorageForTests(storage: Storage | null) {
  storageOverride = storage;
}

export function createMemoryIpfsCacheStorage(): Storage {
  const objects = new Map<string, CachedObject>();
  return {
    async get(key) {
      return objects.get(key) ?? null;
    },
    async put(key, body, contentType) {
      objects.set(key, { body: Buffer.from(body), contentType });
    },
  };
}

const blobStorage: Storage = {
  async get(key) {
    let details: Awaited<ReturnType<typeof head>>;
    try {
      details = await head(key);
    } catch (err) {
      if (isBlobNotFound(err)) return null;
      throw err;
    }
    const response = await fetch(details.downloadUrl);
    if (!response.ok) throw new Error(`Blob read failed for ${key}: HTTP ${response.status}`);
    return {
      body: Buffer.from(await response.arrayBuffer()),
      contentType: details.contentType || "application/octet-stream",
    };
  },
  async put(key, body, contentType) {
    await put(key, new Blob([body], { type: contentType }), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
      cacheControlMaxAge: BLOB_CACHE_MAX_AGE,
    });
  },
};

function storage(): Storage {
  return storageOverride ?? blobStorage;
}

function isBlobNotFound(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "BlobNotFoundError" ||
      err.message.toLowerCase().includes("not found") ||
      err.message.toLowerCase().includes("does not exist"))
  );
}

function blobKey(rootCid: string): string {
  return `${BLOB_PREFIX}/${rootCid}`;
}

// ---------------------------------------------------------------------------
// Parsing & content safety.
// ---------------------------------------------------------------------------

export function parseIpfsPath(rawValue: string): ParsedIpfsPath | null {
  const value = rawValue.startsWith("ipfs://") ? rawValue.slice("ipfs://".length) : rawValue;
  const [rawCidPart, ...rawSegments] = value.split("/");
  const cidPart = decodePathSegment(rawCidPart);
  if (!cidPart) return null;

  let cid: CID;
  try {
    cid = CID.parse(cidPart);
  } catch {
    return null;
  }

  const encodedSegments: string[] = [];
  for (const rawSegment of rawSegments) {
    const segment = decodePathSegment(rawSegment);
    if (!segment || isUnsafePathSegment(segment)) return null;
    try {
      const decodedAgain = decodeURIComponent(segment);
      if (decodedAgain !== segment && isUnsafePathSegment(decodedAgain)) return null;
    } catch {
      return null;
    }
    encodedSegments.push(encodeURIComponent(segment));
  }

  const rootCid = cid.toString();
  return {
    cid,
    rootCid,
    cidPath: [rootCid, ...encodedSegments].join("/"),
    hasSubpath: encodedSegments.length > 0,
  };
}

function decodePathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function isUnsafePathSegment(segment: string): boolean {
  return (
    segment === "" || segment === "." || segment === ".." || hasPathSeparator(segment) || hasControlCharacter(segment)
  );
}

function hasPathSeparator(segment: string): boolean {
  return segment.includes("/") || segment.includes("\\");
}

function hasControlCharacter(segment: string): boolean {
  for (let i = 0; i < segment.length; i++) {
    const code = segment.charCodeAt(i);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

export function safeContentType(rawContentType: string): { value: string; forceAttachment: boolean } {
  const base = rawContentType.split(";")[0].trim().toLowerCase();
  return SAFE_INLINE_TYPES.has(base)
    ? { value: base, forceAttachment: false }
    : { value: "application/octet-stream", forceAttachment: true };
}

// Inert response headers for serving third-party IPFS bytes from our own origin.
export function ipfsResponseHeaders(rawContentType: string): Record<string, string> {
  const safe = safeContentType(rawContentType);
  const headers: Record<string, string> = {
    "Content-Type": safe.value,
    "Cache-Control": IMMUTABLE_CACHE,
    "Content-Security-Policy": NO_EXECUTE_CSP,
    "X-Content-Type-Options": "nosniff",
  };
  if (safe.forceAttachment) headers["Content-Disposition"] = 'attachment; filename="ipfs-content.bin"';
  return headers;
}

// ---------------------------------------------------------------------------
// Verification.
// ---------------------------------------------------------------------------

// True for a directly-verifiable raw sha2-256 single-block CID with no subpath —
// the only shape we durably cache, because we can prove the bytes match the CID.
export function isRawSha256(parsed: ParsedIpfsPath): boolean {
  return !parsed.hasSubpath && parsed.cid.code === rawCodec.code && parsed.cid.multihash.code === sha256.code;
}

async function verifiesRawCid(parsed: ParsedIpfsPath, body: Buffer): Promise<boolean> {
  const digest = await sha256.digest(body);
  return bytesEqual(digest.bytes, parsed.cid.multihash.bytes);
}

// ---------------------------------------------------------------------------
// Gateway fetch (raced) + bounded read.
// ---------------------------------------------------------------------------

export async function fetchFromGateways(parsed: ParsedIpfsPath, verify: boolean): Promise<CachedObject> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT);
  try {
    return await Promise.any(
      IPFS_GATEWAYS.map(async (gateway) => {
        const response = await fetch(`${gateway}/${parsed.cidPath}`, { method: "GET", signal: controller.signal });
        if (!response.ok) throw new Error(`${gateway} returned HTTP ${response.status}`);
        const body = await readBounded(response, MAX_RESPONSE_BYTES);
        if (verify && !(await verifiesRawCid(parsed, body)))
          throw new Error(`${gateway} returned bytes that do not match the CID`);
        controller.abort();
        return { body, contentType: response.headers.get("content-type") ?? "application/octet-stream" };
      })
    );
  } finally {
    clearTimeout(timer);
  }
}

async function readBounded(response: Response, max: number): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) throw new Error(`content-length ${declared} exceeds ${max}`);

  const reader = response.body?.getReader();
  if (!reader) {
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength > max) throw new Error("content exceeds cap");
    return buf;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new Error("content exceeds cap");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Cache read / write-through. One helper, shared by the read route, /api/pin,
// and the one-time seed script.
// ---------------------------------------------------------------------------

// Returns the durably-cached object for a raw CID, re-verifying the bytes
// against the requested CID on every read (so a tampered Blob can't be served).
export async function getCachedIpfs(parsed: ParsedIpfsPath): Promise<CachedObject | null> {
  if (!isRawSha256(parsed)) return null;
  const object = await storage().get(blobKey(parsed.rootCid));
  if (!object) return null;
  if (!(await verifiesRawCid(parsed, object.body))) return null;
  return object;
}

// Verify + store a raw CID in the durable cache. Idempotent: a CID already
// cached is skipped. `bytes` is supplied at pin time (no gateway fetch needed);
// omit it to fetch+verify from the gateways (read-path self-heal / seed).
export async function warmToCache(parsed: ParsedIpfsPath, bytes?: Buffer, contentType?: string): Promise<void> {
  if (!isRawSha256(parsed)) throw new Error(`CID ${parsed.cidPath} is not a directly verifiable raw sha2-256 object`);
  if (await getCachedIpfs(parsed)) return;

  let body = bytes;
  let type = contentType ?? "application/octet-stream";
  if (body) {
    if (!(await verifiesRawCid(parsed, body))) throw new Error(`provided bytes do not match CID ${parsed.rootCid}`);
  } else {
    const fetched = await fetchFromGateways(parsed, true);
    body = fetched.body;
    type = fetched.contentType;
  }

  await storage().put(blobKey(parsed.rootCid), body, safeContentType(type).value);
}
