import type { Chain } from "viem";
import type { TrustedProxyConfig } from "../api/public-protection";
import { createLogger } from "../services/logger";
import { loadReportingConfig } from "../services/reporting/config";
import type { InboundMediaFetcher, OutboundTransport } from "../services/reporting/transport";
import type { ReportingRuntime } from "./reporting";
import { createLiveReportingRuntime } from "./reporting-live";

const log = createLogger("reporting");

/**
 * Chat transports available to this build, by `AGENT_REPORTING_TRANSPORT`. The reporting core
 * ships before any production transport: the WhatsApp adapter registers here in the next stack
 * PR. Until one is registered, enabling reporting logs an error and leaves it off instead of
 * starting a core that could never receive or answer a message.
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
  const config = loadReportingConfig(input.env, {
    chainId: input.chainId,
    isProduction: input.isProduction,
    dataDir: input.dataDir,
  });
  if (!config) return null;
  const name = input.env.AGENT_REPORTING_TRANSPORT?.trim() ?? "";
  const adapter = TRANSPORTS[name];
  if (!adapter) {
    log.error(
      { transport: name || null },
      "Agent reporting is enabled but no transport adapter is available; reporting stays off"
    );
    return null;
  }
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
