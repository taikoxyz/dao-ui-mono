import type { NextApiRequest, NextApiResponse } from "next";
import {
  fetchFromGateways,
  fetchVerifiedDag,
  FAILURE_CACHE,
  getCachedIpfs,
  ipfsResponseHeaders,
  isRawSha256,
  parseIpfsPath,
  type CachedObject,
} from "../../../server/ipfs/mirror";
import { clientIp, rateLimit } from "../../../server/rate-limit";

// On a cold miss we race public gateways server-side; 30s is ample headroom over
// the ~8s gateway-race cap. Warm reads come from Blob/CDN and return in well
// under a second. Cold misses are verified and served without writing to the
// durable cache, so they only spend this request's gateway-fetch budget.
export const config = { maxDuration: 30 };

// This endpoint is public and unauthenticated, and its cold-miss path is
// deliberately expensive (races four gateways). Cap per-IP request rate so a
// flood cannot exhaust serverless concurrency or amplify outbound fetches. Cached
// reads are served from the CDN and never reach the function, so a generous limit
// still comfortably covers a real user opening a page full of proposal cards.
const IPFS_RATE_LIMIT = 60;
const IPFS_RATE_WINDOW_MS = 60_000;

/**
 * Same-origin IPFS read proxy. Everything it serves is verified against the
 * requested CID — there is no unverified path.
 *
 * 1. Serve from the durable Blob cache if present (re-verified against the CID).
 * 2. Otherwise fetch and verify: raw sha2-256 CIDs race the public gateways
 *    (bytes hashed against the CID before a gateway can win); multi-block
 *    content (dag-pb DAGs, subpaths) goes through verified-fetch, which checks
 *    every block of the DAG. Either way the response earns the 1-year immutable
 *    header. A fetch that cannot be verified fails closed with a 502.
 *
 * This route is READ-ONLY: it never writes to the durable Blob cache. It used to
 * mirror verified cold-miss bytes back, gated on the CID appearing on our Pinata
 * pin list — but /api/pin accepts unauthenticated pins, so that gate did not
 * actually prove we chose the content: an attacker could pin their own bytes via
 * /api/pin, GET them here, and have us persist them into our public Blob store.
 * Durable writes now happen only on the (authenticated-by-nothing-yet, but
 * deliberate) pin path; a cold miss here simply serves verified bytes and leans
 * on the immutable CDN cache, which already collapses repeat reads.
 *
 * New proposals are pre-warmed at pin time, so a cold miss is the rare fallback.
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
    serve(req, res, cached);
    return;
  }

  try {
    const fetched = isRawSha256(parsed) ? await fetchFromGateways(parsed) : await fetchVerifiedDag(parsed);
    serve(req, res, fetched);
  } catch {
    res.setHeader("Cache-Control", FAILURE_CACHE);
    res.status(502).json({ error: { reason: "IPFS_UNAVAILABLE", details: "Could not retrieve content from IPFS" } });
  }
}

function serve(req: NextApiRequest, res: NextApiResponse, object: CachedObject) {
  for (const [key, value] of Object.entries(ipfsResponseHeaders(object.contentType))) {
    res.setHeader(key, value);
  }
  res.status(200).send(req.method === "HEAD" ? undefined : object.body);
}

function fail(res: NextApiResponse, status: number, reason: string, details: string) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json({ error: { reason, details } });
}
