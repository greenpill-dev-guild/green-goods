import { getIndexerUrl } from "@green-goods/shared/config/blockchain";
import { getJsonByHash } from "@green-goods/shared/modules/data/ipfs/resolve";
import { getNetworkContracts } from "@green-goods/shared/utils/blockchain/contracts";
import type { Chain } from "viem";
import type { TrustedProxyConfig } from "../api/public-protection";
import { createViemProfileAvatarSignatureVerifier } from "../services/profile-avatars";
import type { ReportingConfig } from "../services/reporting/config";
import { createModelInterpreter } from "../services/reporting/interpretation";
import type { JobKind } from "../services/reporting/jobs";
import { createLiveReportingCatalog } from "../services/reporting/live-catalog";
import { createLiveReportingChain } from "../services/reporting/live-chain";
import { extractWithOpenAI } from "../services/reporting/model-extraction";
import { routeWithJev } from "../services/reporting/model-routing";
import type { ReportingCore } from "../services/reporting/runtime";
import type { InboundMediaFetcher, OutboundTransport } from "../services/reporting/transport";
import { createPinataEvidenceUploader } from "../services/reporting/uploader";
import type { JobHandler } from "../services/reporting/worker";
import { createReportingRuntime, type ReportingRuntime } from "./reporting";

/**
 * Production adapters for the reporting core: Arbitrum reads through the Agent RPC, the indexer
 * and published Action instructions, the configured model providers, Pinata for consented public
 * evidence and the existing EOA/ERC-1271/ERC-6492 proof verifier. The transport is the caller's:
 * a messaging adapter in production, the loopback driver in development.
 */
export function createLiveReportingRuntime(input: {
  config: ReportingConfig;
  chain: Chain;
  chainId: number;
  rpcUrl: string;
  transport: OutboundTransport;
  mediaFetcher: InboundMediaFetcher;
  trustedProxy?: TrustedProxyConfig;
  secureCookies?: boolean;
  workerId?: string;
  jobs?: (core: ReportingCore) => Partial<Record<JobKind, JobHandler>>;
}): ReportingRuntime {
  const { config } = input;
  const chain = createLiveReportingChain({
    chain: input.chain,
    rpcUrl: input.rpcUrl,
    bundlerRpcUrl: config.bundlerRpcUrl,
  });
  const catalog = createLiveReportingCatalog({
    chain,
    indexerUrl: getIndexerUrl(
      { VITE_ENVIO_INDEXER_URL: process.env.VITE_ENVIO_INDEXER_URL },
      false
    ),
    registryAddress: getNetworkContracts(input.chainId).actionRegistry as `0x${string}`,
    fetchInstructions: (cid) => getJsonByHash(cid, { timeoutMs: 5_000 }),
  });
  const { interpretation, openai } = config;
  const interpreter = createModelInterpreter({
    route:
      interpretation.provider === "jev"
        ? (request, signal) => routeWithJev(interpretation, request, signal)
        : null,
    extract: openai ? (request, signal) => extractWithOpenAI(openai, request, signal) : null,
  });
  return createReportingRuntime({
    config,
    chainId: input.chainId,
    chain,
    catalog,
    interpreter,
    uploader: createPinataEvidenceUploader({
      jwt: config.pinata?.jwt,
      ...(config.pinata?.uploadsApiBaseUrl ? { baseUrl: config.pinata.uploadsApiBaseUrl } : {}),
    }),
    verifier: createViemProfileAvatarSignatureVerifier({
      chain: input.chain,
      rpcUrl: input.rpcUrl,
    }),
    transport: input.transport,
    mediaFetcher: input.mediaFetcher,
    ...(input.trustedProxy ? { trustedProxy: input.trustedProxy } : {}),
    ...(input.secureCookies === undefined ? {} : { secureCookies: input.secureCookies }),
    ...(input.workerId ? { workerId: input.workerId } : {}),
    ...(input.jobs ? { jobs: input.jobs } : {}),
  });
}
