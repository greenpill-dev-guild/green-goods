import {
  type PermissionModuleEntry,
  resolveReportingDeployment,
} from "@green-goods/shared/modules/agent-reporting";
import type { MessagingRouteDeps } from "../api/routes/messaging";
import { InMemoryPublicRateLimiter, type TrustedProxyConfig } from "../api/public-protection";
import { createLogger } from "../services/logger";
import { resolveAuthority } from "../services/reporting/authority";
import type { AccountProofVerifier } from "../services/reporting/browser-access";
import type { ReportingCatalog } from "../services/reporting/catalog";
import type { ReportingChain } from "../services/reporting/chain";
import type { ReportingConfig } from "../services/reporting/config";
import { ensureControls } from "../services/reporting/controls";
import { inTransaction, openReportingDatabase } from "../services/reporting/database";
import { type DelegatedSender, executeDelegated } from "../services/reporting/delegated";
import { watchOwnerAttempt } from "../services/reporting/execution";
import { type GrantDeps, reconcileGrant } from "../services/reporting/grants";
import type { ReportInterpreter } from "../services/reporting/interpretation";
import type { JobKind } from "../services/reporting/jobs";
import { createReportingKeyring } from "../services/reporting/keyring";
import { createFilesystemMediaStore } from "../services/reporting/media-store";
import { prepareOperation } from "../services/reporting/preparation";
import { reconcileOperation } from "../services/reporting/reconciliation";
import {
  purgePrivateContent,
  scheduleRetentionSweep,
  sweepRetention,
} from "../services/reporting/retention";
import {
  listPendingReviews,
  openReview,
  type ReviewJobDeps,
  resolveReviewAuthority,
} from "../services/reporting/review-jobs";
import {
  DEFAULT_REPORTING_SETTINGS,
  randomIds,
  type ReportingCore,
  systemClock,
} from "../services/reporting/runtime";
import { createDocumentTools } from "../services/reporting/media/documents";
import { processMedia } from "../services/reporting/media/process";
import type { InboundMediaFetcher, OutboundTransport } from "../services/reporting/transport";
import type { EvidenceUploader } from "../services/reporting/uploader";
import { type JobHandler, type TickSummary, tick } from "../services/reporting/worker";

const log = createLogger("reporting");
const RETENTION_SWEEP_MS = 15 * 60 * 1000;

/**
 * Composes the transport-independent reporting core for one Agent process: its own SQLite file
 * and private media volume, the ceremony API dependencies, and one worker loop that drains every
 * durable queue. A transport adapter (the WhatsApp adapter in the next stack PR, or the loopback
 * development driver) supplies ingress and outbound delivery; nothing here reads a provider.
 */
export interface ReportingRuntimeOptions {
  config: ReportingConfig;
  chainId: number;
  chain: ReportingChain;
  catalog: ReportingCatalog;
  interpreter: ReportInterpreter | null;
  uploader: EvidenceUploader;
  verifier: AccountProofVerifier;
  transport: OutboundTransport;
  /** The transport's authenticated media download; files cannot be processed without it. */
  mediaFetcher: InboundMediaFetcher;
  trustedProxy?: TrustedProxyConfig;
  /** Stays empty until the Kernel permission gates pass; delegation is disabled without entries. */
  delegationModules?: readonly PermissionModuleEntry[];
  /**
   * The restricted executor's signer and the Kernel adapter, supplied only once signer custody
   * and module compatibility are proven. Without it, grants and delegated execution are refused.
   */
  delegation?: {
    sender: DelegatedSender;
    gasCap: number;
    gasPerSubmission: number;
    permissionIdFor: GrantDeps["permissionIdFor"];
  };
  /** Extra job handlers owned by other slices (media processing, retention). */
  jobs?: (core: ReportingCore) => Partial<Record<JobKind, JobHandler>>;
  /** Only the loopback development driver serves plain HTTP cookies. */
  secureCookies?: boolean;
  workerId?: string;
}

export interface ReportingRuntime {
  core: ReportingCore;
  messaging: MessagingRouteDeps;
  tickOnce(): Promise<TickSummary>;
  start(): void;
  stop(): Promise<void>;
}

export function createReportingRuntime(options: ReportingRuntimeOptions): ReportingRuntime {
  const { config } = options;
  const keyring = createReportingKeyring(config.keys);
  const core: ReportingCore = {
    db: openReportingDatabase(config.dbPath),
    keyring,
    clock: systemClock,
    ids: randomIds,
    settings: {
      ...DEFAULT_REPORTING_SETTINGS,
      chainId: options.chainId,
      browserOrigin: config.browserOrigin,
      gardens: config.gardens,
      ...(config.supportContact ? { supportContact: config.supportContact } : {}),
    },
  };
  ensureControls(core, config.initialControls);
  const deployment = resolveReportingDeployment(options.chainId);
  const media = createFilesystemMediaStore(config.mediaDir, keyring);
  const delegationModules = options.delegationModules ?? [];
  const reviewDeps: ReviewJobDeps = {
    core,
    chain: options.chain,
    deployment,
    delegationModules,
  };
  const { delegation } = options;
  const grantDeps: Omit<GrantDeps, "core" | "chain"> | null = delegation
    ? {
        deployment,
        modules: delegationModules,
        signerAddress: delegation.sender.signerAddress,
        gasCap: delegation.gasCap,
        permissionIdFor: delegation.permissionIdFor,
      }
    : null;
  const jobs: Partial<Record<JobKind, JobHandler>> = {
    resolve_authority: (job) =>
      resolveAuthority({ core, chain: options.chain, delegationModules }, job),
    prepare_operation: (job) =>
      prepareOperation(
        {
          core,
          chain: options.chain,
          catalog: options.catalog,
          uploader: options.uploader,
          media,
          deployment,
        },
        job
      ),
    watch_owner_attempt: async (job) => watchOwnerAttempt(core, job),
    reconcile_operation: (job) =>
      reconcileOperation({ core, chain: options.chain, scanWindowBlocks: 50_000n }, job),
    review_list: (job) => listPendingReviews(reviewDeps, job),
    review_open: (job) => openReview(reviewDeps, job),
    review_authority: (job) => resolveReviewAuthority(reviewDeps, job),
    ...(grantDeps && delegation
      ? {
          reconcile_grant: (job) =>
            reconcileGrant({ core, chain: options.chain, ...grantDeps }, job),
          execute_delegated: (job) =>
            executeDelegated(
              {
                core,
                chain: options.chain,
                deployment,
                sender: delegation.sender,
                gasPerSubmission: delegation.gasPerSubmission,
              },
              job
            ),
        }
      : {}),
    process_media: (job) =>
      processMedia(
        {
          core,
          media,
          fetcher: options.mediaFetcher,
          tools: createDocumentTools({ conversionEnabled: config.conversionEnabled }),
          catalog: options.catalog,
          openai: config.openai,
          capabilities: {
            documents: config.documentsEnabled,
            conversion: config.conversionEnabled,
            voice: config.voiceEnabled,
          },
        },
        job
      ),
    purge_private_content: (job) => purgePrivateContent({ core, media }, job),
    retention_sweep: (job) => sweepRetention({ core, media }, job),
    ...options.jobs?.(core),
  };
  const workerDeps = {
    core,
    catalog: options.catalog,
    interpreter: options.interpreter,
    interpretationTimeoutMs: 12_000,
    transport: options.transport,
    jobs,
    workerId: options.workerId ?? `agent-${process.pid}`,
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  let running: Promise<TickSummary> | null = null;
  const tickOnce = async (): Promise<TickSummary> => {
    // One pass at a time: an overlapping interval waits for the pass already in flight.
    if (running) return running;
    running = tick(workerDeps).finally(() => {
      running = null;
    });
    return running;
  };

  return {
    core,
    messaging: {
      core: () => core,
      chain: options.chain,
      verifier: options.verifier,
      media,
      rateLimiter: new InMemoryPublicRateLimiter(),
      ...(grantDeps ? { grants: grantDeps } : {}),
      ...(options.trustedProxy ? { trustedProxy: options.trustedProxy } : {}),
      secureCookies: options.secureCookies ?? true,
      cookiePath: "/api/messaging",
    },
    tickOnce,
    start() {
      if (timer) return;
      timer = setInterval(() => {
        inTransaction(core.db, () => scheduleRetentionSweep(core, RETENTION_SWEEP_MS));
        tickOnce().catch((err) => log.error({ err }, "Reporting worker pass failed"));
      }, config.workerIntervalMs);
      log.info({ intervalMs: config.workerIntervalMs }, "Reporting worker started");
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
      await running?.catch(() => undefined);
      core.db.close();
    },
  };
}
