import { CID } from "multiformats/cid";
import { equals as bytesEqual } from "multiformats/bytes";
import * as rawCodec from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import { head, put } from "@vercel/blob";
import { waitUntil } from "@vercel/functions";

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

// ---------------------------------------------------------------------------
// Pin-list gate for durable writes.
// ---------------------------------------------------------------------------

const PINATA_PIN_LIST_URL = "https://api.pinata.cloud/data/pinList";
const PIN_CHECK_TIMEOUT = 5_000;
const PIN_CHECK_TTL_MS = 60_000;

let pinnedCidCheckOverride: ((rootCid: string) => Promise<boolean>) | null = null;

// Short-TTL memo of pin-list results (both hits AND misses). The read route
// calls isPinnedCid on every verifiable cold miss, and query-string cache
// busting (`/api/ipfs/<cid>?n=1,2,3`) bypasses the CDN, so without this a single
// unpinned CID could be replayed to fire one authenticated Pinata pin-list call
// per request and drain the shared account's quota. Memoizing collapses repeats
// to one call per CID per TTL window.
const pinnedCidMemo = new Map<string, { value: boolean; expiresAt: number }>();

export function setPinnedCidCheckForTests(check: ((rootCid: string) => Promise<boolean>) | null) {
  pinnedCidCheckOverride = check;
}

export function clearPinnedCidMemoForTests() {
  pinnedCidMemo.clear();
}

// True only for CIDs pinned on the project's own Pinata account (i.e. real
// proposal metadata). The read route uses this to gate lazy Blob writes:
// verification alone proves bytes match the CID, but any attacker-pinned IPFS
// object matches its own CID — without this gate an anonymous GET could mirror
// arbitrary content into our public Blob store. Fails closed (not pinned) on
// missing credentials or Pinata errors: we just skip the durable write.
export async function isPinnedCid(rootCid: string): Promise<boolean> {
  if (pinnedCidCheckOverride) return pinnedCidCheckOverride(rootCid);

  const cached = pinnedCidMemo.get(rootCid);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = await queryPinataPinned(rootCid);
  pinnedCidMemo.set(rootCid, { value, expiresAt: Date.now() + PIN_CHECK_TTL_MS });
  return value;
}

async function queryPinataPinned(rootCid: string): Promise<boolean> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return false;

  try {
    const url = `${PINATA_PIN_LIST_URL}?status=pinned&hashContains=${encodeURIComponent(rootCid)}&pageLimit=10`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${jwt}` },
      signal: AbortSignal.timeout(PIN_CHECK_TIMEOUT),
    });
    if (!response.ok) return false;
    const data: unknown = await response.json();
    const rows =
      data && typeof data === "object" && "rows" in data && Array.isArray((data as { rows: unknown }).rows)
        ? (data as { rows: unknown[] }).rows
        : [];
    // hashContains is a substring match on Pinata's side; require an exact hit.
    return rows.some(
      (row) => row && typeof row === "object" && (row as { ipfs_pin_hash?: unknown }).ipfs_pin_hash === rootCid
    );
  } catch {
    return false;
  }
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
function verifiedFetch(): Promise<VerifiedFetchFn> {
  verifiedFetchPromise ??= import("@helia/verified-fetch").then(({ createVerifiedFetch }) =>
    createVerifiedFetch({ gateways: TRUSTLESS_GATEWAYS })
  );
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
// cached is skipped. `bytes` must already be in hand — the pin-time upload, or
// the read route's just-fetched gateway bytes — and are re-verified against the
// CID before the write, so a body that does not hash to its CID can never be
// persisted.
export async function warmToCache(parsed: ParsedIpfsPath, bytes: Buffer, contentType?: string): Promise<void> {
  if (!isRawSha256(parsed)) throw new Error(`CID ${parsed.cidPath} is not a directly verifiable raw sha2-256 object`);
  if (await getCachedIpfs(parsed)) return;
  if (!(await verifiesRawCid(parsed, bytes))) throw new Error(`provided bytes do not match CID ${parsed.rootCid}`);

  await storage().put(blobKey(parsed.rootCid), bytes, safeContentType(contentType ?? "application/octet-stream").value);
}

// ---------------------------------------------------------------------------
// Background work: run a best-effort task (the durable write-through) AFTER the
// response is sent, so it never adds latency to the user's read or risks a
// maxDuration timeout with the bytes already in hand.
// ---------------------------------------------------------------------------

let backgroundCollectorForTests: Promise<unknown>[] | null = null;

// Tests drive the handler directly (no Vercel request context, so `waitUntil`
// is unavailable). Collect background tasks instead so a test can await them and
// assert the write-through landed. Call before invoking the handler.
export function collectBackgroundTasksForTests() {
  backgroundCollectorForTests = [];
}

export async function flushBackgroundTasksForTests(): Promise<void> {
  const pending = backgroundCollectorForTests ?? [];
  backgroundCollectorForTests = [];
  await Promise.allSettled(pending);
}

export function runInBackground(task: Promise<unknown>): void {
  // Swallow errors so a best-effort warm failure can never surface as an
  // unhandled rejection (which would crash the runtime, or fail a test that
  // never awaited it).
  const guarded = task.catch(() => undefined);
  if (backgroundCollectorForTests) {
    backgroundCollectorForTests.push(guarded);
    return;
  }
  // Hand the task to Vercel's waitUntil to keep the function alive until it
  // settles, without delaying the response that was already sent.
  try {
    waitUntil(guarded);
  } catch {
    // Outside a Vercel request context (local dev): plain fire-and-forget.
    void guarded;
  }
}
