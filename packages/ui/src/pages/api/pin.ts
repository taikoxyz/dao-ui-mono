import type { NextApiRequest, NextApiResponse } from "next";
import { UPLOAD_FILE_NAME } from "@/constants";

const PINATA_PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

// Largest real proposal-metadata pin ever observed on the project's Pinata
// account is ~663 KB (across 579 pins, Dec 2024–May 2026). All upload flows
// (multisig / emergency-multisig public+private / delegate announcements)
// are text-only metadata — no inline images/base64. 2 MB gives ~3x headroom
// for any future large proposal while still blocking multi-MB/GB abuse.
const MAX_METADATA_BYTES = 2 * 1024 * 1024;

// Allow the JSON envelope ({"body": <escaped metadata>}) for a 2 MB payload
// through Next's body parser; oversized abuse is still rejected below with a
// structured error rather than Next's opaque default.
export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

function fail(res: NextApiResponse, status: number, reason: string, details: string) {
  res.status(status).json({ error: { reason, details } });
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

// Soft same-origin gate: blocks browser cross-origin use and trivial/CSRF-style
// abuse of this credential-bearing endpoint. NOT strong auth — a non-browser
// client can forge these headers; the size cap bounds per-request damage, and
// real auth/rate-limiting is a deliberately deferred, separately-scoped step.
function isSameOrigin(req: NextApiRequest): boolean {
  const host = req.headers.host;
  const source = req.headers.origin ?? req.headers.referer;
  if (!host || !source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

/**
 * Server-side proxy for pinning proposal metadata to Pinata.
 *
 * The Pinata credential (PINATA_JWT) is a server-only secret and is never
 * exposed to the browser. The client posts the metadata string here; this
 * route attaches the credential and forwards the pin request to Pinata,
 * relaying Pinata's status and body back. Upstream failures (unreachable or
 * non-JSON) are normalized to the same { error: { reason, details } } shape
 * the client surfaces via formatPinataError.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    fail(res, 405, "METHOD_NOT_ALLOWED", "Use POST");
    return;
  }

  if (!isSameOrigin(req)) {
    fail(res, 403, "FORBIDDEN", "Cross-origin requests are not allowed");
    return;
  }

  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    fail(res, 500, "CONFIG_ERROR", "PINATA_JWT is not configured on the server");
    return;
  }

  const parsed: unknown = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const strBody =
    parsed && typeof parsed === "object" && "body" in parsed && typeof (parsed as { body: unknown }).body === "string"
      ? (parsed as { body: string }).body
      : undefined;
  if (strBody === undefined) {
    fail(res, 400, "BAD_REQUEST", "Expected JSON { body: string }");
    return;
  }

  if (Buffer.byteLength(strBody, "utf8") > MAX_METADATA_BYTES) {
    fail(res, 413, "PAYLOAD_TOO_LARGE", `Metadata exceeds the ${MAX_METADATA_BYTES}-byte limit`);
    return;
  }

  const form = new FormData();
  // Use Blob + the filename argument rather than `File`, which is only a
  // global on Node >= 20; the deployment runtime is not pinned here.
  form.append("file", new Blob([strBody], { type: "text/plain" }), UPLOAD_FILE_NAME);
  form.append("pinataMetadata", JSON.stringify({ name: UPLOAD_FILE_NAME }));
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  let pinataRes: Response;
  try {
    pinataRes = await fetch(PINATA_PIN_FILE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    });
  } catch (e) {
    fail(res, 502, "UPSTREAM_ERROR", e instanceof Error ? e.message : "Could not reach Pinata");
    return;
  }

  // Relay Pinata's status and JSON body so the client keeps surfacing the
  // real reason (e.g. plan-usage block) via formatPinataError. A non-JSON
  // upstream response is normalized into the same structured error shape.
  const data = await pinataRes.json().catch(() => null);
  if (data === null) {
    const status = pinataRes.ok ? 502 : pinataRes.status;
    fail(res, status, "BAD_GATEWAY", `Pinata returned a non-JSON response (HTTP ${pinataRes.status})`);
    return;
  }
  res.status(pinataRes.status).json(data);
}
