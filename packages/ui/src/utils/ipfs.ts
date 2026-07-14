import { PUB_IPFS_ENDPOINTS } from "@/constants";
import { Hex, fromHex } from "viem";
import { equals as bytesEqual } from "multiformats/bytes";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import { getPinataFileCid } from "./ipfs-cid";

// Read endpoints, tried in order: the same-origin /api/ipfs proxy (Blob + CDN
// backed) first, then any public-gateway prefixes from NEXT_PUBLIC_IPFS_ENDPOINTS
// as a last-resort fallback for the rare case our origin is unavailable.
const SAME_ORIGIN_IPFS_ENDPOINT = "/api/ipfs";
const IPFS_ENDPOINTS = [
  SAME_ORIGIN_IPFS_ENDPOINT,
  ...PUB_IPFS_ENDPOINTS.split(",")
    .map((endpoint) => endpoint.trim())
    .filter(Boolean),
];

// How long to wait on each endpoint before trying the next. The proxy normally
// answers from Blob/CDN in well under a second; this only bites on a cold miss.
const IPFS_FETCH_TIMEOUT = 12000; // 12 seconds

// Overall budget for one attempt across ALL endpoints, so a hanging endpoint
// plus the public fallback can't stack into ~30s per attempt (which, multiplied
// by react-query retries, left cards "Loading metadata…" for well over a
// minute). Combined with the server-side gateway race, one attempt now settles
// within this budget.
const IPFS_TOTAL_TIMEOUT = 18000; // 18 seconds

export function fetchIpfsAsJson(ipfsUri: string) {
  return fetchRawIpfs(ipfsUri).then((res) => res.json());
}

export function fetchIpfsAsText(ipfsUri: string) {
  return fetchRawIpfs(ipfsUri).then((res) => res.text());
}

export function fetchIpfsAsBlob(ipfsUri: string) {
  return fetchRawIpfs(ipfsUri).then((res) => res.blob());
}

export async function uploadToPinata(strBody: string) {
  // The Pinata credential is server-only. The browser talks to our own
  // same-origin proxy (/api/pin), which attaches the secret and forwards
  // the pin request to Pinata. See src/pages/api/pin.ts.
  const res = await fetch("/api/pin/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body: strBody }),
  });

  const resData = await res.json();

  if (resData.error || !res.ok) throw new Error(`Pinata upload failed (${res.status}): ${formatPinataError(resData)}`);
  else if (!resData.IpfsHash) throw new Error("Could not pin the metadata");
  return "ipfs://" + resData.IpfsHash;
}

export async function getContentCid(strMetadata: string) {
  return "ipfs://" + (await getPinataFileCid(strMetadata));
}

// Internal helpers

let endpointsOverrideForTests: string[] | null = null;

export function setIpfsEndpointsForTests(endpoints: string[] | null) {
  endpointsOverrideForTests = endpoints;
}

// The CID read from the chain is the sha2-256 fingerprint of the content, so
// for a bare raw single-block CID the browser can check the bytes itself
// instead of trusting whatever the /api/ipfs proxy (or a public gateway
// fallback) returned. Multi-block shapes (dag-pb roots, subpaths) pass through
// here — the server verifies those block-by-block via verified-fetch before
// serving them (see server/ipfs/mirror.ts).
function parseVerifiableRawCid(path: string): CID | null {
  if (path.includes("/")) return null;
  try {
    const cid = CID.parse(path);
    return cid.code === raw.code && cid.multihash.code === sha256.code ? cid : null;
  } catch {
    return null;
  }
}

async function matchesRawCid(cid: CID, bytes: Uint8Array): Promise<boolean> {
  const digest = await sha256.digest(bytes);
  return bytesEqual(digest.bytes, cid.multihash.bytes);
}

async function fetchRawIpfs(ipfsUri: string): Promise<Response> {
  if (!ipfsUri) throw new Error("Invalid IPFS URI");
  else if (ipfsUri.startsWith("0x")) {
    // fallback
    ipfsUri = fromHex(ipfsUri as Hex, "string");

    if (!ipfsUri) throw new Error("Invalid IPFS URI");
  }

  const cid = resolvePath(ipfsUri);
  const verifiableCid = parseVerifiableRawCid(cid);
  const deadline = Date.now() + IPFS_TOTAL_TIMEOUT;

  for (const uriPrefix of endpointsOverrideForTests ?? IPFS_ENDPOINTS) {
    // The browser can verify bare raw sha2-256 CIDs itself. Other shapes must
    // come from our same-origin proxy, which verifies every block server-side;
    // never trust unverifiable bytes from a public gateway fallback.
    if (!verifiableCid && uriPrefix !== SAME_ORIGIN_IPFS_ENDPOINT) continue;

    const remaining = deadline - Date.now();
    if (remaining <= 0) break; // overall budget spent — don't start another endpoint

    const controller = new AbortController();
    const abortId = setTimeout(() => controller.abort(), Math.min(IPFS_FETCH_TIMEOUT, remaining));
    try {
      const response = await fetch(`${uriPrefix}/${cid}`, {
        method: "GET",
        signal: controller.signal,
      });
      if (response.ok) {
        if (!verifiableCid) return response; // .json(), .text(), .blob(), etc.

        // Verify in the browser before handing the bytes to the caller. A
        // mismatch means this endpoint served tampered or corrupted content —
        // treat it like a failed endpoint and fall through to the next one.
        const body = new Uint8Array(await response.arrayBuffer());
        if (await matchesRawCid(verifiableCid, body)) {
          return new Response(body, {
            status: 200,
            headers: { "content-type": response.headers.get("content-type") ?? "application/octet-stream" },
          });
        }
        console.warn(`IPFS endpoint ${uriPrefix} returned bytes that do not match ${cid}; trying the next endpoint`);
      }
    } catch {
      // Timed out or network error: fall through only if an operator has
      // explicitly configured more endpoints.
    } finally {
      clearTimeout(abortId);
    }
  }

  throw new Error("Could not connect to any of the IPFS endpoints");
}

function resolvePath(uri: string) {
  const path = uri.includes("ipfs://") ? uri.substring(7) : uri;
  return path;
}

function formatPinataError(resData: unknown) {
  if (!resData || typeof resData !== "object") return "Unknown error";

  const error = "error" in resData ? resData.error : resData;
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "Unknown error";

  const reason = "reason" in error && typeof error.reason === "string" ? error.reason : "";
  const details = "details" in error && typeof error.details === "string" ? error.details : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return [reason, details || message].filter(Boolean).join(" - ") || "Unknown error";
}
