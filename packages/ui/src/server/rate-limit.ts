import type { NextApiRequest } from "next";

// Best-effort, dependency-free per-key fixed-window rate limiter.
//
// IMPORTANT: state lives in the serverless instance's memory and resets on cold
// start, and Vercel scales horizontally, so this bounds abuse PER INSTANCE — it
// raises the cost of a flood and curbs outbound amplification from any single
// instance, but it is not a globally-consistent limit. It is the in-code first
// layer; a Vercel Firewall rate-limit rule (or a shared KV/Upstash store) is the
// durable, cross-instance upgrade. Kept in-code and dependency-free on purpose.

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): RateLimitResult {
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size > MAX_TRACKED_KEYS) sweep(now);
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export function resetRateLimitForTests() {
  windows.clear();
}

// Best-effort client IP. On Vercel `x-forwarded-for` is set by the platform edge
// and its first entry is the real client; fall back to other proxy headers, then
// the socket. A spoofed header only lets an attacker share/rotate their own
// bucket, which does not weaken the per-instance concurrency ceiling this guards.
export function clientIp(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (first) return first.split(",")[0].trim();

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp) return realIp;

  return req.socket?.remoteAddress ?? "unknown";
}
