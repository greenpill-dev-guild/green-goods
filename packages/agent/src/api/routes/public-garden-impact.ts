import { isPublicGardenImpactChainSupported } from "@green-goods/shared/config/blockchain";
import {
  PUBLIC_AGENT_ROUTES,
  PUBLIC_GARDEN_IMPACT_DEFAULT_RECENT_LIMIT,
  PUBLIC_GARDEN_IMPACT_MAX_RECENT_LIMIT,
  type Address,
  type PublicGardenImpactResponseV1,
} from "@green-goods/shared/public-contracts";
import type { Context, Hono } from "hono";
import { getAddress } from "viem";
import { checkRateLimit } from "../http/public";
import { jsonNoStore, safeError } from "../http/responses";
import type { ServerDeps } from "../http/server.types";

const SUCCESS_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_GARDENS = 100;

interface CacheEntry {
  expiresAt: number;
  value?: PublicGardenImpactResponseV1;
  pending?: Promise<PublicGardenImpactResponseV1>;
}

export class PublicGardenImpactCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options: { now?: () => number; ttlMs?: number; maxEntries?: number } = {}) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? CACHE_TTL_MS;
    this.maxEntries = options.maxEntries ?? CACHE_MAX_GARDENS;
  }

  async get(
    key: string,
    load: () => Promise<PublicGardenImpactResponseV1>
  ): Promise<PublicGardenImpactResponseV1> {
    const existing = this.entries.get(key);
    if (existing?.pending) {
      this.touch(key, existing);
      return existing.pending;
    }
    if (existing?.value && existing.expiresAt > this.now()) {
      this.touch(key, existing);
      return existing.value;
    }
    if (existing) this.entries.delete(key);

    const pending = load();
    this.entries.set(key, { expiresAt: Number.POSITIVE_INFINITY, pending });
    this.trim();
    try {
      const value = await pending;
      const current = this.entries.get(key);
      if (current?.pending === pending) {
        this.touch(key, { value, expiresAt: this.now() + this.ttlMs });
      }
      return value;
    } catch (error) {
      if (this.entries.get(key)?.pending === pending) this.entries.delete(key);
      throw error;
    }
  }

  private touch(key: string, entry: CacheEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private trim(): void {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (typeof oldestKey !== "string") return;
      this.entries.delete(oldestKey);
    }
  }
}

interface PublicGardenImpactRouteContext {
  deps: ServerDeps;
}

function setCors(c: Context): void {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type");
  c.header("Access-Control-Max-Age", "600");
}

function publicError(
  c: Context,
  errorCode: "invalid_request" | "not_found" | "rate_limited" | "provider_unavailable",
  message: string,
  status: 400 | 404 | 429 | 503,
  body = safeError(errorCode, message)
) {
  setCors(c);
  return jsonNoStore(c, body, status);
}

function parsePositiveInteger(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = BigInt(value);
  return parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : null;
}

function parseRecentLimit(c: Context): number | null {
  const values = new URL(c.req.url).searchParams.getAll("recentLimit");
  if (values.length === 0) return PUBLIC_GARDEN_IMPACT_DEFAULT_RECENT_LIMIT;
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0] ?? "")) return null;
  const parsed = BigInt(values[0] ?? "0");
  return parsed > BigInt(PUBLIC_GARDEN_IMPACT_MAX_RECENT_LIMIT)
    ? PUBLIC_GARDEN_IMPACT_MAX_RECENT_LIMIT
    : Number(parsed);
}

function parseTarget(
  c: Context,
  deps: ServerDeps
): {
  chainId: number;
  gardenAddress: Address;
  recentLimit: number;
} | null {
  const chainId = parsePositiveInteger(c.req.param("chainId") ?? "");
  const recentLimit = parseRecentLimit(c);
  if (chainId === null || recentLimit === null) return null;
  const supportsChain = deps.publicGardenImpactChainSupported ?? isPublicGardenImpactChainSupported;
  if (!supportsChain(chainId)) return null;
  try {
    return {
      chainId,
      gardenAddress: getAddress(c.req.param("gardenAddress") ?? "") as Address,
      recentLimit,
    };
  } catch {
    return null;
  }
}

function defaultLoader(input: {
  chainId: number;
  gardenAddress: Address;
  recentLimit: number;
}): Promise<PublicGardenImpactResponseV1> {
  return import("@green-goods/shared/modules").then(({ readPublicGardenImpactSnapshot }) =>
    readPublicGardenImpactSnapshot(input)
  );
}

function hasErrorName(error: unknown, name: string): boolean {
  return error instanceof Error && error.name === name;
}

function sliceRecentWork(
  snapshot: PublicGardenImpactResponseV1,
  limit: number
): PublicGardenImpactResponseV1 {
  return {
    ...snapshot,
    recentWork: snapshot.recentWork ? snapshot.recentWork.slice(0, limit) : null,
  };
}

export function registerPublicGardenImpactRoutes(
  app: Hono,
  ctx: PublicGardenImpactRouteContext
): void {
  const cache = new PublicGardenImpactCache({ now: ctx.deps.now });
  app.options(PUBLIC_AGENT_ROUTES.gardenImpact, (c) => {
    setCors(c);
    return c.body(null, 204);
  });
  app.get(PUBLIC_AGENT_ROUTES.gardenImpact, async (c) => {
    const target = parseTarget(c, ctx.deps);
    if (!target) return publicError(c, "invalid_request", "Invalid garden impact request.", 400);

    const material = `${target.chainId}:${target.gardenAddress.toLowerCase()}`;
    const rateError = checkRateLimit(c, ctx.deps, "garden_impact_read", material);
    if (rateError) {
      return publicError(
        c,
        "rate_limited",
        "Too many requests. Please try again later.",
        429,
        rateError
      );
    }

    const loader = ctx.deps.publicGardenImpactLoader ?? defaultLoader;
    try {
      const snapshot = await cache.get(material, () =>
        loader({
          chainId: target.chainId,
          gardenAddress: target.gardenAddress,
          recentLimit: PUBLIC_GARDEN_IMPACT_MAX_RECENT_LIMIT,
        })
      );
      setCors(c);
      return c.json(sliceRecentWork(snapshot, target.recentLimit), 200, {
        "Cache-Control": SUCCESS_CACHE_CONTROL,
      });
    } catch (error) {
      if (hasErrorName(error, "PublicGardenImpactNotFoundError")) {
        return publicError(c, "not_found", "Public garden not found.", 404);
      }
      return publicError(c, "provider_unavailable", "Garden impact is unavailable right now.", 503);
    }
  });
}
