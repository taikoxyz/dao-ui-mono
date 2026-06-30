import type { NextApiRequest, NextApiResponse } from "next";
import {
  fetchFromGateways,
  getCachedIpfs,
  ipfsResponseHeaders,
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
 * 2. Otherwise race public gateways once, write the verified raw object back to
 *    the cache (lazy self-heal), and serve it with a 1-year immutable header so
 *    the CDN absorbs every subsequent read.
 *
 * New proposals are pre-warmed at pin time and existing ones by the one-time
 * seed script, so a cold miss here is the rare fallback, not the common path.
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

  try {
    const cached = await getCachedIpfs(parsed);
    if (cached) {
      serve(req, res, cached);
      return;
    }

    const verifiable = isRawSha256(parsed);
    const fetched = await fetchFromGateways(parsed, verifiable);

    // Persist verifiable raw objects so the next read (any user, any region)
    // hits Blob/CDN instead of a gateway. Best-effort: never block the response.
    if (verifiable) {
      try {
        await warmToCache(parsed, fetched.body, fetched.contentType);
      } catch {
        // Ignore: we still serve the bytes we already have in hand.
      }
    }

    serve(req, res, fetched);
  } catch {
    res.setHeader("Cache-Control", "no-store");
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
