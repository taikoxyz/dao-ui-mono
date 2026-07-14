import { CID } from "multiformats/cid";
import { equals as bytesEqual } from "multiformats/bytes";
import * as rawCodec from "multiformats/codecs/raw";
import * as dagPbCodec from "@ipld/dag-pb";
import { sha256 } from "multiformats/hashes/sha2";
import { head, put } from "@vercel/blob";
import { getPinataFileCid } from "../../utils/ipfs-cid";

// Public gateways raced on a cold miss. Pinata's own gateway is first: it has
// every proposal's metadata pinned, so it resolves fast. The CID is only ever
// appended as a path to one of these hardcoded hosts — never a user-supplied
// host — and redirects are constrained to the allowlist below, so the connected
// host stays inside this set on every hop (SSRF-safe).
const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs",
  "https://ipfs.io/ipfs",
  "https://dweb.link/ipfs",
  "https://w3s.link/ipfs",
];

// The only hosts a gateway request may end up connected to, derived from the
// list above so it stays in sync. Subdomain gateways (dweb.link, w3s.link)
// legitimately 301 a path request to `<cid>.ipfs.<host>`, so any subdomain of a
// trusted gateway host is allowed too — but nothing else, so a gateway that
// tried to redirect us to an arbitrary or internal host is refused.
const GATEWAY_HOSTS = IPFS_GATEWAYS.map((gateway) => new URL(gateway).hostname);

function isAllowedGatewayHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return GATEWAY_HOSTS.some((base) => host === base || host.endsWith(`.${base}`));
}

// CIDs are content hashes, so the bytes can never change — caching forever is
// correct, not a gamble. This header lets Vercel's CDN serve repeat reads from
// the edge without invoking the function or touching Blob. Everything this
// proxy serves is verified against its CID (single raw blocks directly,
// multi-block DAGs block-by-block via verified-fetch), so it applies to all
// success responses.
export const IMMUTABLE_CACHE = "public, s-maxage=31536000, max-age=31536000, immutable";

// A gateway miss/failure is transient, but a flood of the same bogus CID should
// be absorbed by the CDN for a short window instead of re-running the whole
// gateway race on every hit. Short enough that a CID that becomes retrievable
// (e.g. just pinned) is reachable again within the minute.
export const FAILURE_CACHE = "public, s-maxage=60, max-age=0";

const NO_EXECUTE_CSP = "default-src 'none'; sandbox;";
const BLOB_PREFIX = "ipfs-cache/v1";
// Cap the cold-miss gateway race well under the function's maxDuration. Promise
// .any resolves on the fastest of four gateways, so a healthy read returns in
// ~1s; this only bounds the worst case where every gateway is slow.
const GATEWAY_TIMEOUT = 8_000;
const MAX_REDIRECTS = 3;
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

// Inert response headers for serving third-party IPFS bytes from our own
// origin. Callers only reach this with bytes proven to match their CID, so
// every response earns the immutable header.
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

async function verifiesPinnedFileCid(parsed: ParsedIpfsPath, body: Buffer): Promise<boolean> {
  if (isRawSha256(parsed)) return verifiesRawCid(parsed, body);
  if (parsed.hasSubpath || parsed.cid.code !== dagPbCodec.code || parsed.cid.multihash.code !== sha256.code)
    return false;

  return (await getPinataFileCid(body)) === parsed.rootCid;
}

// ---------------------------------------------------------------------------
// Gateway fetch (raced) + bounded read.
// ---------------------------------------------------------------------------

// Race the public gateways for a directly verifiable raw CID. Only called for
// shapes verifiesRawCid can check — multi-block content goes through
// fetchVerifiedDag instead — so every response is verified before it can win.
export async function fetchFromGateways(parsed: ParsedIpfsPath): Promise<CachedObject> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT);
  try {
    return await Promise.any(
      IPFS_GATEWAYS.map(async (gateway) => {
        const response = await gatewayFetch(`${gateway}/${parsed.cidPath}`, controller.signal);
        if (!response.ok) throw new Error(`${gateway} returned HTTP ${response.status}`);
        const body = await readBounded(response, MAX_RESPONSE_BYTES);
        if (!(await verifiesRawCid(parsed, body)))
          throw new Error(`${gateway} returned bytes that do not match the CID`);
        controller.abort();
        return { body, contentType: response.headers.get("content-type") ?? "application/octet-stream" };
      })
    );
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Verified fetch for multi-block content (dag-pb DAGs, subpaths).
// ---------------------------------------------------------------------------

// Trustless-gateway hosts for block-level fetches, dialed DIRECTLY — no
// redirects are involved, so the connected host is always exactly one of
// these. gateway.pinata.cloud serves blocks natively and has every proposal
// pinned; trustless-gateway.link is Interplanetary Shipyard's dedicated block
// endpoint (ipfs.io and dweb.link redirect block requests there anyway).
const TRUSTLESS_GATEWAYS = ["https://gateway.pinata.cloud", "https://trustless-gateway.link"];

// Multi-block fetches make one round trip per ~256 KiB block, so give them
// more headroom than the single-shot raw race while staying under maxDuration.
const VERIFIED_FETCH_TIMEOUT = 15_000;

type VerifiedFetchFn = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

let verifiedFetchPromise: Promise<VerifiedFetchFn> | null = null;
let verifiedFetchOverride: VerifiedFetchFn | null = null;

export function setVerifiedFetchForTests(fn: VerifiedFetchFn | null) {
  verifiedFetchOverride = fn;
}

// Lazy so the Helia dependency tree is only loaded (and its gateway sessions
// only created) on the first multi-block cold miss, not on every function boot.
// Use HTTP-only Helia: createVerifiedFetch's default constructor also starts a
// full libp2p/WebRTC node, whose native workers can keep a server process busy
// after the request has completed. This endpoint only uses the fixed trustless
// HTTP gateways above, so peer-to-peer transports add risk without capability.
// A failed construction must NOT stay memoized: caching the rejected promise
// would make one transient import/session error permanently disable multi-block
// reads for the whole life of the instance, so drop it and let the next request
// retry.
function verifiedFetch(): Promise<VerifiedFetchFn> {
  verifiedFetchPromise ??= Promise.all([import("@helia/verified-fetch"), import("@helia/http"), import("helia")])
    .then(async ([{ createVerifiedFetch }, { withHTTP }, { createHeliaLight }]) => {
      const helia = await withHTTP(createHeliaLight(), { recursiveGateways: TRUSTLESS_GATEWAYS }).start();
      return createVerifiedFetch(helia);
    })
    .catch((err) => {
      verifiedFetchPromise = null;
      throw err;
    });
  return verifiedFetchPromise;
}

// Fetch content we cannot check as a single block (dag-pb DAGs, subpaths) via
// the trustless gateway protocol: every block is hash-verified against its own
// CID as the DAG is walked from the root the chain pinned, so the reassembled
// bytes carry the same guarantee as a directly verified raw block. Fails
// closed — there is no unverified fallback, so a disrupted trustless fetch can
// never downgrade a response to unverified bytes.
export async function fetchVerifiedDag(parsed: ParsedIpfsPath): Promise<CachedObject> {
  const doFetch = verifiedFetchOverride ?? (await verifiedFetch());
  const response = await doFetch(`ipfs://${parsed.cidPath}`, {
    signal: AbortSignal.timeout(VERIFIED_FETCH_TIMEOUT),
  });
  if (!response.ok) throw new Error(`verified fetch for ${parsed.cidPath} returned HTTP ${response.status}`);
  const body = await readBounded(response, MAX_RESPONSE_BYTES);
  return { body, contentType: detectContentType(body, response.headers.get("content-type")) };
}

// verified-fetch reassembles bytes from raw blocks, so there is no upstream
// Content-Type header worth trusting (it defaults to octet-stream, which our
// safety headers turn into a forced download). Sniff JSON — the only content
// real proposals store — and otherwise keep whatever was declared.
function detectContentType(body: Buffer, declared: string | null): string {
  try {
    JSON.parse(body.toString("utf8"));
    return "application/json";
  } catch {
    return declared ?? "application/octet-stream";
  }
}

// Fetch a gateway URL while keeping the connected host inside the gateway
// allowlist on EVERY hop. We follow redirects manually (fetch's default
// `redirect: "follow"` would transparently chase a gateway's 3xx to any host,
// including an internal/metadata address — an SSRF vector) and refuse any
// redirect whose target host is not an allowed gateway host. Subdomain gateways
// legitimately redirect `.../ipfs/<cid>` to `<cid>.ipfs.<host>`, which the
// allowlist permits; anything else throws so Promise.any moves to another
// gateway.
async function gatewayFetch(url: string, signal: AbortSignal): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, { method: "GET", redirect: "manual", signal });
    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get("location");
    if (!location) throw new Error(`redirect from ${current} had no Location`);
    const target = new URL(location, current);
    if (target.protocol !== "https:" || !isAllowedGatewayHost(target.hostname))
      throw new Error(`redirect to disallowed host ${target.host}`);
    current = target.toString();
  }
  throw new Error(`too many redirects for ${url}`);
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
// Cache read / write-through. One helper, shared by the read route and /api/pin.
// ---------------------------------------------------------------------------

// Returns a durably-cached pin-time object, re-verifying raw blocks directly or
// rebuilding Pinata's UnixFS dag-pb root (so a tampered Blob can't be served).
export async function getCachedIpfs(parsed: ParsedIpfsPath): Promise<CachedObject | null> {
  const object = await storage().get(blobKey(parsed.rootCid));
  if (!object) return null;
  if (!(await verifiesPinnedFileCid(parsed, object.body))) return null;
  return object;
}

// Verify + store a raw or Pinata UnixFS file CID in the durable cache.
// Idempotent: a CID already cached is skipped. `bytes` must already be in hand
// from the pin-time upload (the ONLY caller), and are re-verified against the
// CID before the write, so mismatched content can never be persisted.
//
// The read route deliberately does NOT write here. It once lazily mirrored any
// verified cold-miss bytes, gated on the CID being on our Pinata pin list, but
// that gate assumed only we can pin to our own account — and /api/pin accepts
// unauthenticated pins, so an attacker could pin content, request it, and have
// us mirror it into our public Blob store. Writes now happen only on the pin
// path; reads rely on the immutable CDN cache instead.
export async function warmToCache(parsed: ParsedIpfsPath, bytes: Buffer, contentType?: string): Promise<void> {
  if (await getCachedIpfs(parsed)) return;
  if (!(await verifiesPinnedFileCid(parsed, bytes)))
    throw new Error(`provided bytes do not match CID ${parsed.rootCid}`);

  await storage().put(blobKey(parsed.rootCid), bytes, safeContentType(contentType ?? "application/octet-stream").value);
}
