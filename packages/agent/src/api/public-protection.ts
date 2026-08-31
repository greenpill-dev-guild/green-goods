import { createHash } from "node:crypto";
import { isIP } from "node:net";

export type PublicRouteClass =
  | "subscribe"
  | "funding_create"
  | "funding_proof"
  | "receipt_read"
  | "garden_impact_read"
  | "upload_sign"
  | "profile_avatar_read"
  | "profile_avatar_mutation"
  | "saved_offers_challenge"
  | "saved_offers_session"
  | "saved_offers_read"
  | "saved_offers_mutation"
  | "join_request_create"
  | "join_request_create_ip"
  | "join_request_create_account"
  | "join_request_create_garden"
  | "join_request_read"
  | "join_request_resolve"
  | "webhook_pre"
  | "webhook_post";

export interface TrustedProxyConfig {
  hops?: number;
  cidrs?: string[];
  /** Test-only transport identity injection. Never enable from request or production config. */
  allowTestSocketIp?: boolean;
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
  garden_impact_read: { limit: 120, windowMs: 10 * 60 * 1000 },
  upload_sign: { limit: 20, windowMs: 60 * 1000 },
  profile_avatar_read: { limit: 120, windowMs: 10 * 60 * 1000 },
  profile_avatar_mutation: { limit: 10, windowMs: 10 * 60 * 1000 },
  saved_offers_challenge: { limit: 10, windowMs: 10 * 60 * 1000 },
  saved_offers_session: { limit: 10, windowMs: 10 * 60 * 1000 },
  saved_offers_read: { limit: 120, windowMs: 10 * 60 * 1000 },
  saved_offers_mutation: { limit: 30, windowMs: 10 * 60 * 1000 },
  join_request_create: { limit: 10, windowMs: 10 * 60 * 1000 },
  join_request_create_ip: { limit: 30, windowMs: 10 * 60 * 1000 },
  join_request_create_account: { limit: 3, windowMs: 24 * 60 * 60 * 1000 },
  join_request_create_garden: { limit: 50, windowMs: 24 * 60 * 60 * 1000 },
  join_request_read: { limit: 120, windowMs: 10 * 60 * 1000 },
  join_request_resolve: { limit: 30, windowMs: 10 * 60 * 1000 },
  webhook_pre: { limit: 300, windowMs: 60 * 1000 },
  webhook_post: { limit: 300, windowMs: 60 * 1000 },
} as const satisfies Record<PublicRouteClass, RateLimitPolicy>;

const requestPeerIps = new WeakMap<Request, string>();

/** Bind the transport peer observed by Bun before the request enters Hono. */
export function bindPublicRequestPeerIp(request: Request, peerIp: string): void {
  requestPeerIps.set(request, normalizeIp(peerIp) ?? peerIp);
}

function normalizePublicOrigin(origin: string | null): string {
  if (!origin) return "none";
  try {
    const parsed = new URL(origin);
    return parsed.origin.toLowerCase();
  } catch {
    return "invalid";
  }
}

function hashPublicRateLimitMaterial(material: string): string {
  return createHash("sha256").update(material).digest("hex");
}

export function derivePublicClientIp(
  request: Request,
  trustedProxy: TrustedProxyConfig = {}
): string {
  const testIp = trustedProxy.allowTestSocketIp
    ? normalizeIp(request.headers.get("x-gg-test-socket-ip") ?? "")
    : null;
  const directIp = testIp ?? requestPeerIps.get(request) ?? "unresolved-peer";
  const hops = Math.max(0, trustedProxy.hops ?? 0);
  if (hops === 0) return directIp;

  const cidrs = trustedProxy.cidrs ?? [];
  if (!cidrs.some((cidr) => ipMatchesCidr(directIp, cidr))) return directIp;

  const forwarded = request.headers.get("x-forwarded-for") ?? request.headers.get("forwarded");
  if (!forwarded) return directIp;

  if (forwarded.includes("for=")) {
    const match = forwarded.match(/for="?([^;,"]+)/i);
    return normalizeIp(match?.[1]?.trim() ?? "") ?? directIp;
  }

  const parts = forwarded
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return normalizeIp(parts[Math.max(0, parts.length - hops)] ?? "") ?? directIp;
}

function normalizeIp(value: string): string | null {
  let candidate = value.trim();
  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(":"));
  }
  if (candidate.startsWith("::ffff:") && isIP(candidate.slice(7)) === 4) {
    candidate = candidate.slice(7);
  }
  return isIP(candidate) ? candidate.toLowerCase() : null;
}

function ipMatchesCidr(ip: string, cidr: string): boolean {
  const normalizedIp = normalizeIp(ip);
  const [networkText, prefixText] = cidr.trim().split("/");
  const normalizedNetwork = normalizeIp(networkText ?? "");
  if (!normalizedIp || !normalizedNetwork) return false;
  const version = isIP(normalizedIp);
  if (version !== isIP(normalizedNetwork)) return false;
  const bits = version === 4 ? 32 : 128;
  const prefix = prefixText === undefined ? bits : Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return false;
  const shift = BigInt(bits - prefix);
  return ipToBigInt(normalizedIp) >> shift === ipToBigInt(normalizedNetwork) >> shift;
}

function ipToBigInt(ip: string): bigint {
  if (isIP(ip) === 4) {
    return ip.split(".").reduce((value, octet) => (value << 8n) | BigInt(octet), 0n);
  }
  const [head = "", tail = ""] = ip.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = 8 - headParts.length - tailParts.length;
  const parts = [...headParts, ...Array(Math.max(0, missing)).fill("0"), ...tailParts];
  return parts.reduce((value, part) => (value << 16n) | BigInt(`0x${part || "0"}`), 0n);
}

export function publicRateLimitKey(input: PublicRateLimitKeyInput): string {
  const origin = normalizePublicOrigin(input.request.headers.get("origin"));
  const ip = derivePublicClientIp(input.request, input.trustedProxy);
  const hashedMaterial = hashPublicRateLimitMaterial(input.material ?? "");
  return [input.route, origin, ip, hashedMaterial].join(":");
}

export function publicIpRateLimitKey(input: Omit<PublicRateLimitKeyInput, "material">): string {
  const origin = normalizePublicOrigin(input.request.headers.get("origin"));
  const ip = derivePublicClientIp(input.request, input.trustedProxy);
  return [input.route, origin, ip, "ip"].join(":");
}

/** Build an origin-independent pre-authentication key for one IP and resource. */
export function publicIpMaterialRateLimitKey(input: PublicRateLimitKeyInput): string {
  const ip = derivePublicClientIp(input.request, input.trustedProxy);
  const hashedMaterial = hashPublicRateLimitMaterial(input.material ?? "");
  return [input.route, ip, hashedMaterial].join(":");
}

/**
 * Build a rate-limit key for an authenticated resource identity.
 *
 * Unlike publicRateLimitKey, this intentionally excludes the request IP and
 * origin. Account and garden limits must follow the signed identity across
 * networks without also imposing the same low ceiling on everyone sharing an
 * IP address.
 */
export function publicMaterialRateLimitKey(
  input: Pick<PublicRateLimitKeyInput, "route" | "material">
): string {
  return [input.route, "material", hashPublicRateLimitMaterial(input.material ?? "")].join(":");
}

export class InMemoryPublicRateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  private nextSweepAt = 0;

  check(key: string, policy: RateLimitPolicy, now: number = Date.now()): RateLimitResult {
    if (now >= this.nextSweepAt) {
      for (const [bucketKey, bucket] of this.buckets) {
        if (bucket.resetAt <= now) this.buckets.delete(bucketKey);
      }
      this.nextSweepAt = now + 60_000;
    }
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

  release(key: string, now: number = Date.now()): void {
    const existing = this.buckets.get(key);
    if (!existing) return;
    if (existing.resetAt <= now || existing.count <= 1) {
      this.buckets.delete(key);
      return;
    }
    existing.count -= 1;
  }

  clear(): void {
    this.buckets.clear();
  }
}

function parseAllowedOrigins(value?: string): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((origin) => normalizePublicOrigin(origin.trim()))
      .filter((origin) => origin !== "none" && origin !== "invalid")
  );
}

const LOCAL_DEVELOPMENT_PUBLIC_ORIGINS = [
  "http://localhost:3001",
  "https://localhost:3001",
  "http://127.0.0.1:3001",
  "https://127.0.0.1:3001",
  "http://localhost:3002",
  "https://localhost:3002",
  "http://127.0.0.1:3002",
  "https://127.0.0.1:3002",
] as const;

export function resolveAllowedOrigins(
  value?: string,
  options: { includeDevelopmentDefaults?: boolean } = {}
): Set<string> {
  const configuredOrigins = parseAllowedOrigins(value);
  if (configuredOrigins.size > 0 || !options.includeDevelopmentDefaults) {
    return configuredOrigins;
  }

  return new Set(LOCAL_DEVELOPMENT_PUBLIC_ORIGINS);
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
