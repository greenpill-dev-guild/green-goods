import {
  PUBLIC_AGENT_ROUTES,
  isPublicCommitmentImpactChainSupported,
  parsePublicCommitmentImpactResponse,
  serializePublicCommitmentImpact,
  type PublicCommitmentImpactRecord,
  type PublicCommitmentImpactResponseV1,
} from "@green-goods/shared/public-contracts";
import type { Context, Hono } from "hono";
import { checkRateLimit } from "../http/public";
import { jsonNoStore, safeError } from "../http/responses";
import type { ServerDeps } from "../http/server.types";

interface CacheEntry {
  expiresAt: number;
  pending?: Promise<PublicCommitmentImpactResponseV1>;
  value?: PublicCommitmentImpactResponseV1;
}

function setCors(c: Context): void {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type");
  c.header("Access-Control-Max-Age", "600");
}

function defaultLoader(chainId: number): Promise<PublicCommitmentImpactRecord> {
  return import("@green-goods/shared/commitment-pooling/public").then(
    ({ getPublicCommitmentImpact }) => getPublicCommitmentImpact(chainId)
  );
}

/** Share one bounded, read-only snapshot per supported chain across website visitors. */
export function registerPublicCommitmentImpactRoutes(app: Hono, ctx: { deps: ServerDeps }): void {
  // The chain allowlist bounds this map to two entries, including pending loads.
  const cache = new Map<number, CacheEntry>();
  const now = ctx.deps.now ?? Date.now;
  const load = ctx.deps.publicCommitmentImpactLoader ?? defaultLoader;
  async function snapshot(chainId: number): Promise<PublicCommitmentImpactResponseV1> {
    const cached = cache.get(chainId);
    if (cached?.pending) return cached.pending;
    if (cached?.value && cached.expiresAt > now()) return cached.value;
    const pending = Promise.resolve().then(async () => {
      const value = serializePublicCommitmentImpact(await load(chainId), chainId);
      parsePublicCommitmentImpactResponse(value, chainId);
      return value;
    });
    cache.set(chainId, { expiresAt: 0, pending });
    try {
      const value = await pending;
      cache.set(chainId, { value, expiresAt: now() + (value.partialData ? 30000 : 300000) });
      return value;
    } catch (error) {
      cache.delete(chainId);
      throw error;
    }
  }

  app.options(PUBLIC_AGENT_ROUTES.commitmentImpact, (c) => {
    setCors(c);
    return c.body(null, 204);
  });
  app.get(PUBLIC_AGENT_ROUTES.commitmentImpact, async (c) => {
    setCors(c);
    const rawChainId = c.req.param("chainId") ?? "";
    const chainId = Number(rawChainId);
    if (!/^[1-9]\d*$/.test(rawChainId) || !isPublicCommitmentImpactChainSupported(chainId)) {
      return jsonNoStore(
        c,
        safeError("invalid_request", "Invalid commitment impact request."),
        400
      );
    }
    const rateError = checkRateLimit(c, ctx.deps, "commitment_impact_read", String(chainId));
    if (rateError) return jsonNoStore(c, rateError, 429);
    try {
      const value = await snapshot(chainId);
      return c.json(value, 200, {
        "Cache-Control": value.partialData ? "no-store" : "public, max-age=60, s-maxage=300",
      });
    } catch {
      return jsonNoStore(
        c,
        safeError("provider_unavailable", "Commitment impact is unavailable right now."),
        503
      );
    }
  });
}
