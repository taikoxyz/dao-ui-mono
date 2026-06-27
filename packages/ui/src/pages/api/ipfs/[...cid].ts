import type { NextApiRequest, NextApiResponse } from "next";
import { CID } from "multiformats/cid";

// Public IPFS gateways raced in parallel. The first to return a usable
// response wins; the rest are aborted. This list is the ONLY set of hosts this
// route will ever talk to — the user-supplied CID is never turned into a host,
// so there is no open-proxy / SSRF surface.
const GATEWAYS = [
  "https://ipfs.io/ipfs",
  "https://dweb.link/ipfs",
  "https://w3s.link/ipfs",
  "https://4everland.io/ipfs",
  "https://gateway.pinata.cloud/ipfs",
];

// Cold CIDs on public gateways routinely take several seconds; one observed
// proposal CID took ~25s on ipfs.io. We race all gateways, so the slowest one
// never gates us — this bound just stops a permanently-dead CID from hanging
// the serverless invocation forever.
const GATEWAY_TIMEOUT = 10_000;

// CIDs are content hashes — the bytes behind one can never change — so the
// successful response is safe to cache forever (shared CDN + browser).
const IMMUTABLE_CACHE = "public, s-maxage=31536000, max-age=31536000, immutable";

// This route will fetch ANY CID, not just ones we pinned (uploads are capped at
// 2 MB by /api/pin). Without a read cap, an attacker could pin a multi-GB blob
// elsewhere and have us buffer it into serverless memory on demand. 10 MB is
// ~15x the largest real proposal pin and still bounds memory/cost per request.
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

// The proxy serves third-party, attacker-pinnable bytes from OUR origin. These
// headers stop that content from ever executing as script in our security
// context if a victim is lured to open /api/ipfs/<cid> directly: `nosniff`
// blocks MIME-sniffing a text body into HTML, and the `sandbox` CSP renders any
// document inert (unique opaque origin, no scripts, no storage access).
const NO_EXECUTE_CSP = "default-src 'none'; sandbox;";

// Content-types we will echo verbatim. The client reads bytes via .json()
// (content-type agnostic), so anything scriptable — text/html, image/svg+xml,
// xml — is collapsed to an inert download type rather than forwarded.
const SAFE_CONTENT_TYPES = new Set([
  "application/json",
  "text/plain",
  "application/octet-stream",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

function safeContentType(raw: string): string {
  const base = raw.split(";")[0].trim().toLowerCase();
  return SAFE_CONTENT_TYPES.has(base) ? base : "application/octet-stream";
}

function fail(res: NextApiResponse, status: number, reason: string, details: string) {
  // A transient gateway failure must NEVER get pinned in the CDN, or every
  // future request for this CID would be served the cached error.
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json({ error: { reason, details } });
}

// SSRF guard: only a syntactically valid IPFS CID (v0 or v1) is accepted. An
// optional `/sub/path` suffix is allowed (some metadata is addressed as
// CID/path) but path traversal segments are rejected. Returns the sanitized
// `cid` (or `cid/sub/path`) to forward, or null if the input is not a CID.
function sanitizeCidPath(raw: string): string | null {
  const [cidPart, ...rest] = raw.split("/");
  try {
    CID.parse(cidPart);
  } catch {
    return null;
  }
  if (rest.some((seg) => seg === "" || seg === "." || seg === "..")) return null;
  return [cidPart, ...rest].join("/");
}

type Fetched = { body: Buffer; contentType: string };

// Read a response body while enforcing a hard byte cap, so a hostile/oversized
// upstream cannot exhaust memory. Rejects (failing this gateway) if the content
// exceeds the cap, via the declared length or the actual streamed bytes.
async function readBounded(response: Response, max: number): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) {
    throw new Error(`content-length ${declared} exceeds ${max}`);
  }
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

// Fetch a CID from one gateway. Resolves only on a 2xx response whose body has
// been fully read (so the shared abort below can cancel the losers without
// truncating the winner). Rejects on non-2xx, network error, oversize, or abort.
async function fetchFromGateway(prefix: string, cidPath: string, signal: AbortSignal): Promise<Fetched> {
  const response = await fetch(`${prefix}/${cidPath}`, { method: "GET", signal });
  if (!response.ok) throw new Error(`${prefix} returned HTTP ${response.status}`);
  const body = await readBounded(response, MAX_RESPONSE_BYTES);
  // IPFS content is opaque bytes to us: most proposal metadata is JSON, but
  // emergency-proposal metadata is encrypted ciphertext. Relay the upstream
  // content-type and default to JSON only when none was provided.
  const contentType = response.headers.get("content-type") ?? "application/json";
  return { body, contentType };
}

/**
 * Server-side read proxy + CDN cache for immutable IPFS content.
 *
 * The free Pinata tier has no dedicated read gateway, so "cold" CIDs on public
 * gateways are slow (2–10s) or time out, which leaves proposal cards stuck on
 * "Loading metadata…". This route fetches a CID once via a race across several
 * public gateways and returns it with a 1-year immutable Cache-Control, so the
 * deployment's CDN serves every subsequent request (for every user) from the
 * edge in sub-100ms — without holding any Pinata secret.
 *
 * It is a cache over immutable public content, not a source of truth: the
 * client keeps the public gateways as a fallback if this route is unavailable.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    fail(res, 405, "METHOD_NOT_ALLOWED", "Use GET");
    return;
  }

  const rawCid = Array.isArray(req.query.cid) ? req.query.cid.join("/") : (req.query.cid ?? "");
  const cidPath = sanitizeCidPath(rawCid);
  if (!cidPath) {
    fail(res, 400, "BAD_REQUEST", "Path is not a valid IPFS CID");
    return;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, GATEWAY_TIMEOUT);

  try {
    const result = await Promise.any(GATEWAYS.map((prefix) => fetchFromGateway(prefix, cidPath, controller.signal)));
    // Winner's body is fully buffered; cancel the still-in-flight losers.
    controller.abort();
    res.setHeader("Cache-Control", IMMUTABLE_CACHE);
    res.setHeader("Content-Type", safeContentType(result.contentType));
    // Defense-in-depth against serving attacker-pinned content same-origin.
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", NO_EXECUTE_CSP);
    res.status(200).send(req.method === "HEAD" ? undefined : result.body);
  } catch {
    if (timedOut) {
      fail(res, 504, "GATEWAY_TIMEOUT", "All IPFS gateways timed out");
    } else {
      fail(res, 502, "BAD_GATEWAY", "Could not fetch the CID from any IPFS gateway");
    }
  } finally {
    clearTimeout(timeout);
  }
}
