import { PUB_IPFS_ENDPOINTS } from "@/constants";
import { Hex, fromHex, toBytes } from "viem";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";

const IPFS_FETCH_TIMEOUT = 1000; // 1 second

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
  const res = await fetch("/api/pin", {
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

  const uriPrefixes = PUB_IPFS_ENDPOINTS.split(",").filter((uri) => !!uri.trim());
  if (!uriPrefixes.length) throw new Error("No available IPFS endpoints to fetch from");

  const cid = resolvePath(ipfsUri);

  for (const uriPrefix of uriPrefixes) {
    const controller = new AbortController();
    const abortId = setTimeout(() => controller.abort(), IPFS_FETCH_TIMEOUT);
    const response = await fetch(`${uriPrefix}/${cid}`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(abortId);
    if (!response.ok) continue;

    return response; // .json(), .text(), .blob(), etc.
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
