import { createHash } from "node:crypto";

export type PublicRouteClass =
  | "subscribe"
  | "funding_create"
  | "funding_proof"
  | "receipt_read"
  | "upload_sign"
  | "webhook_pre"
  | "webhook_post";

export interface TrustedProxyConfig {
  hops?: number;
  cidrs?: string[];
}

export interface PublicRateLimitKeyInput {
  route: PublicRouteClass;
  request: Request;
  material?: string;
  trustedProxy?: TrustedProxyConfig;
}

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export const PUBLIC_RATE_LIMIT_POLICIES = {
  subscribe: { limit: 5, windowMs: 60 * 60 * 1000 },
  funding_create: { limit: 10, windowMs: 10 * 60 * 1000 },
  funding_proof: { limit: 10, windowMs: 10 * 60 * 1000 },
  receipt_read: { limit: 60, windowMs: 10 * 60 * 1000 },
  upload_sign: { limit: 20, windowMs: 60 * 1000 },
  webhook_pre: { limit: 300, windowMs: 60 * 1000 },
  webhook_post: { limit: 300, windowMs: 60 * 1000 },
} as const satisfies Record<PublicRouteClass, RateLimitPolicy>;

export function normalizePublicOrigin(origin: string | null): string {
  if (!origin) return "none";
  try {
    const parsed = new URL(origin);
    return parsed.origin.toLowerCase();
  } catch {
    return "invalid";
  }
}

export function hashPublicRateLimitMaterial(material: string): string {
  return createHash("sha256").update(material).digest("hex");
}

export function derivePublicClientIp(
  request: Request,
  trustedProxy: TrustedProxyConfig = {}
): string {
  const directIp = request.headers.get("x-gg-test-socket-ip") ?? "socket";
  const hops = Math.max(0, trustedProxy.hops ?? 0);
  if (hops === 0) return directIp;

  const forwarded = request.headers.get("x-forwarded-for") ?? request.headers.get("forwarded");
  if (!forwarded) return directIp;

  if (forwarded.includes("for=")) {
    const match = forwarded.match(/for="?([^;,"]+)/i);
    return match?.[1]?.trim() || directIp;
  }

  const parts = forwarded
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[Math.max(0, parts.length - hops)] ?? directIp;
}

export function publicRateLimitKey(input: PublicRateLimitKeyInput): string {
  const origin = normalizePublicOrigin(input.request.headers.get("origin"));
  const ip = derivePublicClientIp(input.request, input.trustedProxy);
  const hashedMaterial = hashPublicRateLimitMaterial(input.material ?? "");
  return [input.route, origin, ip, hashedMaterial].join(":");
}

export class InMemoryPublicRateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  check(key: string, policy: RateLimitPolicy, now: number = Date.now()): RateLimitResult {
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + policy.windowMs });
      return { allowed: true };
    }

    if (existing.count >= policy.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      };
    }

    existing.count += 1;
    return { allowed: true };
  }

  clear(): void {
    this.buckets.clear();
  }
}

export function parseAllowedOrigins(value?: string): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((origin) => normalizePublicOrigin(origin.trim()))
      .filter((origin) => origin !== "none" && origin !== "invalid")
  );
}

function isGreenGoodsVercelPreviewOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:") return false;
    return /^green-goods(?:-[a-z0-9-]+)?-greenpilldevguild\.vercel\.app$/.test(
      hostname.toLowerCase()
    );
  } catch {
    return false;
  }
}

export function isOriginAllowed(request: Request, allowedOrigins: Set<string>): boolean {
  if (allowedOrigins.size === 0) return false;
  const origin = normalizePublicOrigin(request.headers.get("origin"));
  return (
    origin !== "none" && (allowedOrigins.has(origin) || isGreenGoodsVercelPreviewOrigin(origin))
  );
}
