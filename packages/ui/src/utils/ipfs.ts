import { PUB_IPFS_ENDPOINTS } from "@/constants";
import { Hex, fromHex, toBytes } from "viem";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";

// Read endpoints, tried in order: the same-origin /api/ipfs proxy (Blob + CDN
// backed) first, then any public-gateway prefixes from NEXT_PUBLIC_IPFS_ENDPOINTS
// as a last-resort fallback for the rare case our origin is unavailable.
const IPFS_ENDPOINTS = [
  "/api/ipfs",
  ...PUB_IPFS_ENDPOINTS.split(",")
    .map((endpoint) => endpoint.trim())
    .filter(Boolean),
];

// How long to wait on each endpoint before trying the next. The proxy normally
// answers from Blob/CDN in well under a second; this only bites on a cold miss.
const IPFS_FETCH_TIMEOUT = 15000; // 15 seconds

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
  const bytes = raw.encode(toBytes(strMetadata));
  const hash = await sha256.digest(bytes);
  const cid = CID.create(1, raw.code, hash);
  return "ipfs://" + cid.toV1().toString();
}

// Internal helpers

async function fetchRawIpfs(ipfsUri: string): Promise<Response> {
  if (!ipfsUri) throw new Error("Invalid IPFS URI");
  else if (ipfsUri.startsWith("0x")) {
    // fallback
    ipfsUri = fromHex(ipfsUri as Hex, "string");

    if (!ipfsUri) throw new Error("Invalid IPFS URI");
  }

  const cid = resolvePath(ipfsUri);

  for (const uriPrefix of IPFS_ENDPOINTS) {
    const controller = new AbortController();
    const abortId = setTimeout(() => controller.abort(), IPFS_FETCH_TIMEOUT);
    try {
      const response = await fetch(`${uriPrefix}/${cid}`, {
        method: "GET",
        signal: controller.signal,
      });
      if (response.ok) return response; // .json(), .text(), .blob(), etc.
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
