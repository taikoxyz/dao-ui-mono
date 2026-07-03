import type { NextApiRequest, NextApiResponse } from "next";
import {
  fetchFromGateways,
  getCachedIpfs,
  ipfsResponseHeaders,
  isPinnedCid,
  isRawSha256,
  parseIpfsPath,
  warmToCache,
  type CachedObject,
} from "../../../server/ipfs/mirror";

// On a cold miss we race public gateways server-side; give it room (Pro allows
// up to 300s). Warm reads come from Blob/CDN and return in well under a second.
export const config = { maxDuration: 30 };

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

    // Persist verified raw objects so the next read (any user, any region) hits
    // Blob/CDN instead of a gateway — but only CIDs our Pinata account actually
    // pinned. Best-effort: never block or fail the response.
    if (verifiable) {
      try {
        if (await isPinnedCid(parsed.rootCid)) {
          await warmToCache(parsed, fetched.body, fetched.contentType);
        }
      } catch {
        // Ignore: we still serve the bytes we already have in hand.
      }
    }

    serve(req, res, fetched, verifiable);
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: { reason: "IPFS_UNAVAILABLE", details: "Could not retrieve content from IPFS" } });
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
