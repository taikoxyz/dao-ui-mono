import type { NextApiRequest, NextApiResponse } from "next";
import {
  fetchFromGateways,
  FAILURE_CACHE,
  getCachedIpfs,
  ipfsResponseHeaders,
  isPinnedCid,
  isRawSha256,
  parseIpfsPath,
  runInBackground,
  warmToCache,
  type CachedObject,
  type ParsedIpfsPath,
} from "../../../server/ipfs/mirror";
import { clientIp, rateLimit } from "../../../server/rate-limit";

// On a cold miss we race public gateways server-side; 30s is ample headroom over
// the ~8s gateway-race cap. Warm reads come from Blob/CDN and return in well
// under a second. The durable write runs in the background (see below), so it
// never competes with this budget for the user-facing response.
export const config = { maxDuration: 30 };

// This endpoint is public and unauthenticated, and its cold-miss path is
// deliberately expensive (races four gateways). Cap per-IP request rate so a
// flood cannot exhaust serverless concurrency or amplify outbound fetches. Cached
// reads are served from the CDN and never reach the function, so a generous limit
// still comfortably covers a real user opening a page full of proposal cards.
const IPFS_RATE_LIMIT = 60;
const IPFS_RATE_WINDOW_MS = 60_000;

/**
 * Same-origin IPFS read proxy.
 *
 * 1. Serve from the durable Blob cache if present (re-verified against the CID).
 * 2. Otherwise race public gateways once and serve the result. Verifiable bytes
 *    (raw sha2-256, no subpath) get a 1-year immutable header so the CDN absorbs
 *    every subsequent read; unverifiable bytes get a short TTL instead, so a bad
 *    gateway response cannot be pinned at the edge for a year.
 * 3. Write verified bytes back to the durable cache (lazy self-heal) — but only
 *    for CIDs pinned on the project's Pinata account, so anonymous GETs cannot
 *    mirror arbitrary attacker-pinned IPFS content into our public Blob store.
 *
 * New proposals are pre-warmed at pin time, so a cold miss here is the rare
 * fallback, not the common path.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    fail(res, 405, "METHOD_NOT_ALLOWED", "Use GET");
    return;
  }

  const limit = rateLimit(`ipfs:${clientIp(req)}`, IPFS_RATE_LIMIT, IPFS_RATE_WINDOW_MS);
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSeconds));
    fail(res, 429, "RATE_LIMITED", "Too many requests");
    return;
  }

  const rawCid = Array.isArray(req.query.cid) ? req.query.cid.join("/") : (req.query.cid ?? "");
  const parsed = parseIpfsPath(rawCid);
  if (!parsed) {
    fail(res, 400, "BAD_REQUEST", "Path is not a valid IPFS CID");
    return;
  }

  // A Blob outage (or missing token) must degrade to the gateway race, not take
  // the whole proxy down — treat any cache-read failure as a miss.
  let cached: CachedObject | null = null;
  try {
    cached = await getCachedIpfs(parsed);
  } catch {
    cached = null;
  }
  if (cached) {
    serve(req, res, cached, true);
    return;
  }

  try {
    const verifiable = isRawSha256(parsed);
    const fetched = await fetchFromGateways(parsed, verifiable);

    // Serve the bytes we already have in hand immediately. Persisting them so the
    // next read (any user, any region) hits Blob/CDN instead of a gateway is
    // genuinely best-effort — it runs AFTER the response, so a slow pin-check or
    // Blob write can never delay the user or push us past maxDuration with the
    // bytes unserved. Gated to CIDs our Pinata account actually pinned, so
    // anonymous GETs cannot mirror attacker-pinned content into our Blob store.
    serve(req, res, fetched, verifiable);
    if (verifiable) runInBackground(warmIfPinned(parsed, fetched));
  } catch {
    res.setHeader("Cache-Control", FAILURE_CACHE);
    res.status(502).json({ error: { reason: "IPFS_UNAVAILABLE", details: "Could not retrieve content from IPFS" } });
  }
}

async function warmIfPinned(parsed: ParsedIpfsPath, fetched: CachedObject): Promise<void> {
  if (await isPinnedCid(parsed.rootCid)) {
    await warmToCache(parsed, fetched.body, fetched.contentType);
  }
}

function serve(req: NextApiRequest, res: NextApiResponse, object: CachedObject, verified: boolean) {
  for (const [key, value] of Object.entries(ipfsResponseHeaders(object.contentType, verified))) {
    res.setHeader(key, value);
  }
  res.status(200).send(req.method === "HEAD" ? undefined : object.body);
}

function fail(res: NextApiResponse, status: number, reason: string, details: string) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json({ error: { reason, details } });
}
