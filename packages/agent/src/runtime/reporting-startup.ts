import type { Chain } from "viem";
import type { TrustedProxyConfig } from "../api/public-protection";
import { createLogger } from "../services/logger";
import { loadReportingConfig } from "../services/reporting/config";
import type { InboundMediaFetcher, OutboundTransport } from "../services/reporting/transport";
import type { ReportingRuntime } from "./reporting";
import { createLiveReportingRuntime } from "./reporting-live";

const log = createLogger("reporting");

/**
 * Chat transports available to this build, by `AGENT_REPORTING_TRANSPORT`, which is also the on
 * switch: empty keeps reporting off. The reporting core ships before any production transport;
 * the WhatsApp adapter registers here as `whatsapp` in the next stack PR. Until one is registered,
 * a set value logs an error and leaves reporting off instead of starting a core that could never
 * receive or answer a message. The synthetic test transport is never registered here.
 */
export interface TransportAdapter {
  transport: OutboundTransport;
  mediaFetcher: InboundMediaFetcher;
}

const TRANSPORTS: Record<string, () => TransportAdapter> = {};

export function startReporting(input: {
  env: Record<string, string | undefined>;
  chain: Chain;
  chainId: number;
  rpcUrl: string;
  isProduction: boolean;
  /** The directory of the Agent's database; reporting data lives beside it. */
  dataDir: string;
  trustedProxy?: TrustedProxyConfig;
}): ReportingRuntime | null {
  const loaded = loadReportingConfig(input.env, {
    chainId: input.chainId,
    isProduction: input.isProduction,
    dataDir: input.dataDir,
  });
  if (!loaded) return null;
  const adapter = TRANSPORTS[loaded.transport];
  if (!adapter) {
    log.error(
      { transport: loaded.transport },
      "AGENT_REPORTING_TRANSPORT names a transport this build does not have; reporting stays off"
    );
    return null;
  }
  const { config } = loaded;
  log.info(
    {
      transport: loaded.transport,
      extraction: Boolean(config.openai),
      transcription: Boolean(config.openai?.transcriptionModel),
      jev: config.interpretation.provider === "jev",
    },
    "Agent reporting starting; model providers without a pinned model stay off"
  );
  const runtime = createLiveReportingRuntime({
    config,
    chain: input.chain,
    chainId: input.chainId,
    rpcUrl: input.rpcUrl,
    ...adapter(),
    ...(input.trustedProxy ? { trustedProxy: input.trustedProxy } : {}),
  });
  runtime.start();
  return runtime;
}
