/**
 * HTTP API Server
 *
 * Composition root for the Hono server, public routes, and funding transport.
 */

import { publicProviderProofRegistry } from "@green-goods/shared/public-contracts";
import { Hono } from "hono";
import * as db from "../services/db";
import { MemoryFundingIntentStore, sweepFundingIntents } from "../services/funding-intents";
import { loggers } from "../services/logger";
import { captureAgentException } from "../services/sentry";
import { requireApiAuth } from "./http/auth";
import type { ApiRouteContext } from "./http/route-context";
import type { AgentServer, ServerConfig, ServerDeps } from "./http/server.types";
import { hasReceiptTokenBody } from "./funding/records";
import { registerFundingRoutes, type FundingRouteContext } from "./funding/routes";
import {
  createThirdwebCheckoutClient,
  type ThirdwebCheckoutClient,
  type ThirdwebCheckoutClientConfig,
  type ThirdwebCheckoutResult,
} from "./funding/thirdweb";
import { registerHealthRoutes } from "./routes/health";
import { registerMessageRoutes } from "./routes/messages";
import { registerSubscribeRoutes } from "./routes/subscribe";
import { registerUploadSignRoutes } from "./routes/upload-sign";
import { registerProfileAvatarRoutes } from "./routes/profile-avatars";
import { createSqliteProfileAvatarStore } from "../services/profile-avatars";
import { registerSavedOfferRoutes } from "./routes/saved-offers";
import { bindPublicRequestPeerIp } from "./public-protection";
import { registerGardenJoinRequestRoutes } from "./routes/garden-join-requests";
import { publicBrowserCorsPreflight, publicBrowserCorsResponse } from "./http/public";
import { trackGardenJoinRequestEvent } from "../services/analytics";

const log = loggers.api;

export type {
  AgentServer,
  ServerConfig,
  ServerDeps,
  UploadSigningConfig,
} from "./http/server.types";

export { createThirdwebCheckoutClient, hasReceiptTokenBody };
export type { ThirdwebCheckoutClient, ThirdwebCheckoutClientConfig, ThirdwebCheckoutResult };

const runningServers = new WeakMap<AgentServer, ReturnType<typeof Bun.serve>>();

/** Create and configure the Hono server. */
export function createServer(deps: ServerDeps, _config?: Partial<ServerConfig>): AgentServer {
  const app = new Hono() as AgentServer;
  app.onError((err, c) => {
    log.error({ err, route: c.req.path, method: c.req.method }, "Unhandled API error");
    captureAgentException(err, {
      source: "hono.onError",
      surface: "api",
      route: c.req.path,
      method: c.req.method,
      status: 500,
    });
    return c.json({ error: "Internal server error" }, 500);
  });

  const fundingIntents = deps.fundingIntents ?? new MemoryFundingIntentStore();
  const providerProofRegistry = deps.providerProofRegistry ?? publicProviderProofRegistry;
  const fundingSweepIntervalMs =
    deps.fundingSweepIntervalMs === undefined ? 5 * 60 * 1000 : deps.fundingSweepIntervalMs;
  let sweepTimer: ReturnType<typeof setInterval> | null = null;
  if (fundingSweepIntervalMs > 0) {
    sweepTimer = setInterval(() => {
      void sweepFundingIntents(fundingIntents, deps.now ?? Date.now).catch((err) => {
        log.warn({ err }, "Scheduled funding intent sweep failed");
      });
    }, fundingSweepIntervalMs);
    if (typeof sweepTimer === "object" && sweepTimer && "unref" in sweepTimer) {
      (sweepTimer as { unref?: () => void }).unref?.();
    }
  }

  const chatSweepIntervalMs =
    deps.chatMessageSweepIntervalMs === undefined
      ? 24 * 60 * 60 * 1000
      : deps.chatMessageSweepIntervalMs;
  const chatRetentionMs =
    deps.chatMessageRetentionMs === undefined
      ? 30 * 24 * 60 * 60 * 1000
      : deps.chatMessageRetentionMs;
  let chatSweepTimer: ReturnType<typeof setInterval> | null = null;
  if (chatSweepIntervalMs > 0) {
    chatSweepTimer = setInterval(() => {
      const cutoff = (deps.now?.() ?? Date.now()) - chatRetentionMs;
      void db
        .sweepStaleChatMessages(cutoff)
        .then((result) => {
          if (result.pruned > 0 || result.staleNew > 0 || result.staleProcessing > 0) {
            log.info(result, "chat_messages sweep complete");
          }
        })
        .catch((err) => {
          log.warn({ err }, "Scheduled chat_messages sweep failed");
        });
    }, chatSweepIntervalMs);
    if (typeof chatSweepTimer === "object" && chatSweepTimer && "unref" in chatSweepTimer) {
      (chatSweepTimer as { unref?: () => void }).unref?.();
    }
  }

  const joinRequestSweepIntervalMs =
    deps.gardenJoinRequestSweepIntervalMs === undefined
      ? 24 * 60 * 60 * 1000
      : deps.gardenJoinRequestSweepIntervalMs;
  let joinRequestSweepTimer: ReturnType<typeof setInterval> | null = null;
  const joinRequestsEnabled = deps.gardenJoinRequestsEnabled === true;
  const joinRequestsAvailable = Boolean(
    joinRequestsEnabled &&
      deps.gardenJoinRequestStore &&
      deps.gardenJoinRequestChainId &&
      deps.gardenJoinRequestChainReader &&
      deps.gardenJoinRequestSignatureVerifier
  );
  const sweepJoinRequests = () =>
    deps
      .gardenJoinRequestStore!.sweep(new Date(deps.now?.() ?? Date.now()).toISOString())
      .then((result) => {
        if (result.deleted > 0) {
          void trackGardenJoinRequestEvent("join_request_expired", { count: result.deleted });
        }
      })
      .catch((err) => log.warn({ err }, "Garden join-request retention sweep failed"));
  if (deps.gardenJoinRequestStore && joinRequestSweepIntervalMs > 0) {
    void sweepJoinRequests();
    joinRequestSweepTimer = setInterval(() => void sweepJoinRequests(), joinRequestSweepIntervalMs);
    if (
      typeof joinRequestSweepTimer === "object" &&
      joinRequestSweepTimer &&
      "unref" in joinRequestSweepTimer
    ) {
      (joinRequestSweepTimer as { unref?: () => void }).unref?.();
    }
  }

  app.close = async () => {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
    if (chatSweepTimer) {
      clearInterval(chatSweepTimer);
      chatSweepTimer = null;
    }
    if (joinRequestSweepTimer) {
      clearInterval(joinRequestSweepTimer);
      joinRequestSweepTimer = null;
    }
    const server = runningServers.get(app);
    if (server) {
      server.stop(true);
      runningServers.delete(app);
    }
  };

  const routeContext: ApiRouteContext = { deps, auth: requireApiAuth(deps) };
  registerHealthRoutes(app, routeContext);
  registerUploadSignRoutes(app, routeContext);
  registerMessageRoutes(app, routeContext);
  registerSubscribeRoutes(app, routeContext);
  registerProfileAvatarRoutes(app, {
    ...routeContext,
    profileAvatarStore: deps.profileAvatarStore ?? createSqliteProfileAvatarStore(),
  });
  registerSavedOfferRoutes(app, {
    ...routeContext,
    savedOfferStore: deps.savedOfferStore,
    savedOffersSessionStore: deps.savedOffersSessionStore,
  });
  const joinRequestAvailabilityRoute = "/public/features/garden-join-requests";
  app.options(joinRequestAvailabilityRoute, (c) => publicBrowserCorsPreflight(c, deps));
  app.get(joinRequestAvailabilityRoute, (c) =>
    publicBrowserCorsResponse(c, deps, { ok: true, enabled: joinRequestsAvailable })
  );
  if (joinRequestsAvailable) {
    registerGardenJoinRequestRoutes(app, {
      ...routeContext,
      store: deps.gardenJoinRequestStore,
    });
  }

  const fundingRouteContext: FundingRouteContext = {
    deps,
    fundingIntents,
    providerProofRegistry,
    now: deps.now ?? Date.now,
    thirdwebCheckout: deps.thirdwebCheckout,
    confirmationDeps: {
      confirmFundingTransaction: deps.confirmFundingTransaction,
      confirmFundingTuple: deps.confirmFundingTuple,
      readVaultShareBalance: deps.readVaultShareBalance,
    },
  };
  registerFundingRoutes(app, fundingRouteContext);
  return app;
}

/** Start the server with Bun's HTTP runtime. */
export async function startServer(app: AgentServer, config: ServerConfig): Promise<void> {
  try {
    const server = Bun.serve({
      port: config.port,
      hostname: config.host || "0.0.0.0",
      fetch(request, bunServer) {
        const peerIp = bunServer.requestIP(request)?.address;
        if (peerIp) bindPublicRequestPeerIp(request, peerIp);
        return app.fetch(request);
      },
    });
    runningServers.set(app, server);
    log.info({ port: config.port, host: config.host }, "Server listening");
  } catch (err) {
    log.error({ err }, "Server failed to start");
    throw err;
  }
}
