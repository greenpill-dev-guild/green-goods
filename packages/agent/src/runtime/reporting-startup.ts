import { Telegram } from "telegraf";
import type { Chain } from "viem";
import type { TrustedProxyConfig } from "../api/public-protection";
import {
  createTelegramMediaFetcher,
  createTelegramTransport,
  telegramRealm,
} from "../platforms/telegram-reporting";
import { createLogger } from "../services/logger";
import { channelOfRealm, type ReportingChannel } from "../services/reporting/channels";
import { loadReportingConfig } from "../services/reporting/config";
import type { InboundMediaFetcher, OutboundTransport } from "../services/reporting/transport";
import type { ReportingRuntime } from "./reporting";
import { createLiveReportingRuntime } from "./reporting-live";

const log = createLogger("reporting");

/** What a chat channel's adapter gives the core: sending replies and downloading media. */
export interface TransportAdapter {
  transport: OutboundTransport;
  mediaFetcher: InboundMediaFetcher;
}

/** Builds a channel's adapter from this Agent's configuration, or null without its credentials. */
type ChannelConnector = (env: Record<string, string | undefined>) => TransportAdapter | null;

/**
 * The chat channel adapters in this build. Telegram runs on the Agent's existing bot whenever its
 * Telegram runtime runs; WhatsApp registers here once its business account is restored. An
 * available adapter takes reports only while its channel's operator control is on
 * (`acceptChannelEvent`); the synthetic test transport is never registered here.
 */
const CHANNEL_ADAPTERS: Partial<Record<ReportingChannel, ChannelConnector>> = {
  telegram: (env) => {
    const token =
      env.AGENT_DISABLE_TELEGRAM_RUNTIME === "true" ? undefined : env.TELEGRAM_BOT_TOKEN;
    const realm = token ? telegramRealm(token) : null;
    if (!token || !realm) return null;
    const telegram = new Telegram(token);
    return {
      transport: createTelegramTransport(telegram),
      mediaFetcher: createTelegramMediaFetcher(telegram, realm),
    };
  },
};

/** A started reporting runtime and the chat channels it serves. */
export type StartedReporting = ReportingRuntime & { channels: ReadonlySet<ReportingChannel> };

/** Sends each reply and downloads each file through the adapter of the channel its realm names. */
export function routeChannels(
  adapters: ReadonlyMap<ReportingChannel, TransportAdapter>
): TransportAdapter {
  const adapterFor = (realm: string) => {
    const channel = channelOfRealm(realm);
    return channel ? (adapters.get(channel) ?? null) : null;
  };
  return {
    transport: {
      async send(request) {
        const adapter = adapterFor(request.providerRealm);
        return adapter
          ? adapter.transport.send(request)
          : { status: "terminal", errorCode: "channel_unavailable" };
      },
    },
    mediaFetcher: {
      async fetch(realm, media, limits) {
        const adapter = adapterFor(realm);
        if (!adapter) throw new Error("No chat channel serves this realm");
        return adapter.mediaFetcher.fetch(realm, media, limits);
      },
    },
  };
}

/**
 * Starts reporting when this Agent has its key list and at least one chat channel's credentials.
 * Nothing reaches people until an operator turns on a channel and intake.
 */
export function startReporting(input: {
  env: Record<string, string | undefined>;
  chain: Chain;
  chainId: number;
  rpcUrl: string;
  isProduction: boolean;
  /** The directory of the Agent's database; reporting data lives beside it. */
  dataDir: string;
  trustedProxy?: TrustedProxyConfig;
}): StartedReporting | null {
  const config = loadReportingConfig(input.env, {
    isProduction: input.isProduction,
    dataDir: input.dataDir,
  });
  if (!config) return null;
  const adapters = new Map<ReportingChannel, TransportAdapter>();
  for (const [channel, connect] of Object.entries(CHANNEL_ADAPTERS)) {
    const adapter = connect?.(input.env);
    if (adapter) adapters.set(channel as ReportingChannel, adapter);
  }
  if (adapters.size === 0) {
    log.info("Agent reporting has its keys but no chat channel is available; it stays off");
    return null;
  }
  log.info(
    {
      channels: [...adapters.keys()],
      extraction: Boolean(config.openai),
      transcription: Boolean(config.openai?.transcriptionModel),
      jev: config.interpretation.provider === "jev",
    },
    "Agent reporting starting; channels take reports only while their operator control is on"
  );
  const runtime = createLiveReportingRuntime({
    config,
    chain: input.chain,
    chainId: input.chainId,
    rpcUrl: input.rpcUrl,
    ...routeChannels(adapters),
    ...(input.trustedProxy ? { trustedProxy: input.trustedProxy } : {}),
  });
  runtime.start();
  return { ...runtime, channels: new Set(adapters.keys()) };
}
