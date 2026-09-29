import type { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { verifyMessage } from "viem";
import { registerMessagingRoutes } from "../../../api/routes/messaging";
import { InMemoryPublicRateLimiter } from "../../../api/public-protection";
import { resolveAuthority } from "../../../services/reporting/authority";
import type { AccountProofVerifier } from "../../../services/reporting/browser-access";
import { watchOwnerAttempt } from "../../../services/reporting/execution";
import { createFilesystemMediaStore } from "../../../services/reporting/media-store";
import { processMedia } from "../../../services/reporting/media/process";
import type { OpenAIConfig } from "../../../services/reporting/openai-responses";
import { prepareOperation } from "../../../services/reporting/preparation";
import { reconcileOperation } from "../../../services/reporting/reconciliation";
import { executeDelegated } from "../../../services/reporting/delegated";
import { reconcileGrant } from "../../../services/reporting/grants";
import { purgePrivateContent, sweepRetention } from "../../../services/reporting/retention";
import {
  listPendingReviews,
  openReview,
  type ReviewJobDeps,
  resolveReviewAuthority,
} from "../../../services/reporting/review-jobs";
import { ensureControls, type ControlName } from "../../../services/reporting/controls";
import { openReportingDatabase } from "../../../services/reporting/database";
import { createReportingKeyring } from "../../../services/reporting/keyring";
import {
  DEFAULT_REPORTING_SETTINGS,
  type ReportingCore,
  type ReportingSettings,
} from "../../../services/reporting/runtime";
import type {
  InboundMessageEvent,
  NormalizedInboundEvent,
} from "../../../services/reporting/transport";
import {
  drain,
  type JobHandler,
  type ReportingWorkerDeps,
  type TickSummary,
} from "../../../services/reporting/worker";
import type { ReportingGarden } from "../../../services/reporting/gardens";
import {
  FixtureCatalog,
  FixtureInterpreter,
  fixedGardens,
  ManualClock,
  RecordingTransport,
  SequentialIds,
  TEST_KEYS,
} from "./fixtures";
import { FixtureUploader } from "./browser";
import { FakeDelegatedSender } from "./delegated";
import { FakeChain } from "./fake-chain";
import { mountSyntheticIngress } from "./synthetic";
import { FakeAudioTools, FakeDocumentTools, FixtureMediaFetcher } from "./media";

export interface Person {
  realm: string;
  chatId: string;
  subjectId: string;
  locale?: string;
}

export const ADA: Person = {
  realm: "synthetic:wefa",
  chatId: "chat-ada",
  subjectId: "+2340000000001",
};
export const BOLA: Person = {
  realm: "synthetic:wefa",
  chatId: "chat-bola",
  subjectId: "+2340000000002",
};

export interface HarnessOptions {
  controls?: Partial<Record<ControlName, boolean>>;
  /** The gardens the directory lists; TAS and Aiyeloja Family Garden by default. */
  gardens?: ReportingGarden[];
  settings?: Partial<ReportingSettings>;
  jobs?: (harness: Harness) => ReportingWorkerDeps["jobs"];
}

export class Harness {
  readonly dir = mkdtempSync(join(tmpdir(), "gg-agent-reporting-"));
  readonly clock = new ManualClock();
  readonly ids = new SequentialIds();
  readonly catalog = new FixtureCatalog();
  readonly interpreter = new FixtureInterpreter();
  readonly transport = new RecordingTransport();
  readonly app = new Hono();
  readonly chain = new FakeChain();
  readonly uploader = new FixtureUploader();
  readonly sender = new FakeDelegatedSender(this.chain);
  /** The permission identifier the fake Kernel adapter derives for every grant. */
  readonly permissionId = "0x7e57ab1e" as const;
  readonly mediaFiles = new Map<string, Uint8Array>();
  readonly mediaFailures = { remaining: 0 };
  readonly documents = new FakeDocumentTools();
  readonly audio = new FakeAudioTools();
  openai: (OpenAIConfig & { transcriptionModel?: string | null }) | null = null;
  /** Key material for the next `open`; a test rotates it and restarts. */
  keys = TEST_KEYS;
  readonly delegationModules: import("@green-goods/shared/modules/agent-reporting").PermissionModuleEntry[] =
    [];
  /** Smart-account proofs are fixtures: a Kernel address accepts the signature `0x6b65726e656c`. */
  readonly verifier: AccountProofVerifier = async ({ address, message, signature }) =>
    this.chain.kernels.has(address.toLowerCase())
      ? signature === "0x6b65726e656c"
      : verifyMessage({ address, message, signature });
  core: ReportingCore;
  private eventCounter = 0;

  constructor(private readonly options: HarnessOptions = {}) {
    this.core = this.open();
    ensureControls(this.core, {
      intake: true,
      model_processing: false,
      documents: true,
      voice: false,
      publication: true,
      outbound_messages: true,
      channel_whatsapp: false,
      channel_telegram: false,
      ...options.controls,
    });
    mountSyntheticIngress(this.app, () => this.core);
    registerMessagingRoutes(this.app, {
      core: () => this.core,
      chain: this.chain,
      verifier: this.verifier,
      media: this.media(),
      rateLimiter: new InMemoryPublicRateLimiter(),
      secureCookies: true,
      cookiePath: "/api/messaging",
      grants: this.grantDeps(),
    });
  }

  grantDeps() {
    return {
      deployment: this.chain.deployment,
      modules: this.delegationModules,
      signerAddress: this.sender.signerAddress,
      gasCap: 2_000_000,
      permissionIdFor: async () => this.permissionId,
    };
  }

  reviewDeps(): ReviewJobDeps {
    return {
      core: this.core,
      chain: this.chain,
      deployment: this.chain.deployment,
      delegationModules: this.delegationModules,
    };
  }

  media() {
    return createFilesystemMediaStore(join(this.dir, "media"), this.core.keyring);
  }

  private open(): ReportingCore {
    const db: Database = openReportingDatabase(join(this.dir, "reporting.db"));
    return {
      db,
      keyring: createReportingKeyring(this.keys),
      clock: this.clock,
      ids: this.ids,
      settings: {
        ...DEFAULT_REPORTING_SETTINGS,
        chainId: 42161,
        browserOrigin: "https://greengoods.test",
        ...this.options.settings,
      },
      gardens: fixedGardens(this.options.gardens),
    };
  }

  /** Simulates a process restart: the database file survives, in-memory state does not. */
  restart(): void {
    this.core.db.close();
    this.core = this.open();
  }

  deps(jobs: Record<string, JobHandler> = {}): ReportingWorkerDeps {
    return {
      core: this.core,
      catalog: this.catalog,
      interpreter: this.interpreter,
      interpretationTimeoutMs: 2_000,
      transport: this.transport,
      jobs: {
        resolve_authority: (job) =>
          resolveAuthority(
            { core: this.core, chain: this.chain, delegationModules: this.delegationModules },
            job
          ),
        prepare_operation: (job) =>
          prepareOperation(
            {
              core: this.core,
              chain: this.chain,
              catalog: this.catalog,
              uploader: this.uploader,
              media: this.media(),
              deployment: this.chain.deployment,
            },
            job
          ),
        watch_owner_attempt: async (job) => watchOwnerAttempt(this.core, job),
        review_list: (job) => listPendingReviews(this.reviewDeps(), job),
        reconcile_grant: (job) =>
          reconcileGrant({ core: this.core, chain: this.chain, ...this.grantDeps() }, job),
        execute_delegated: (job) =>
          executeDelegated(
            {
              core: this.core,
              chain: this.chain,
              deployment: this.chain.deployment,
              sender: this.sender,
              gasPerSubmission: 200_000,
            },
            job
          ),
        review_open: (job) => openReview(this.reviewDeps(), job),
        review_authority: (job) => resolveReviewAuthority(this.reviewDeps(), job),
        process_media: (job) =>
          processMedia(
            {
              core: this.core,
              media: this.media(),
              fetcher: new FixtureMediaFetcher(this.mediaFiles, this.mediaFailures),
              tools: this.documents,
              audio: this.audio,
              catalog: this.catalog,
              openai: this.openai,
            },
            job
          ),
        purge_private_content: (job) =>
          purgePrivateContent({ core: this.core, media: this.media() }, job),
        retention_sweep: (job) => sweepRetention({ core: this.core, media: this.media() }, job),
        reconcile_operation: (job) =>
          reconcileOperation(
            { core: this.core, chain: this.chain, scanWindowBlocks: 10_000n },
            job
          ),
        ...this.options.jobs?.(this),
        ...jobs,
      },
      workerId: "worker-a",
    };
  }

  async drain(): Promise<TickSummary> {
    return drain(this.deps());
  }

  async post(event: NormalizedInboundEvent): Promise<Response> {
    return this.app.request("/__synthetic/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
  }

  message(person: Person, fields: Partial<InboundMessageEvent> = {}): InboundMessageEvent {
    this.eventCounter += 1;
    return {
      kind: "message",
      providerRealm: person.realm,
      eventId: `evt-${this.eventCounter}`,
      providerMessageId: `in-${this.eventCounter}`,
      chat: { externalChatId: person.chatId, kind: "direct" },
      sender: { externalSubjectId: person.subjectId },
      sentAt: this.clock.now(),
      ...(person.locale ? { locale: person.locale } : {}),
      ...fields,
    };
  }

  /** Sends a message through the Hono ingress and runs every queue to quiescence. */
  async say(
    person: Person,
    text: string,
    fields: Partial<InboundMessageEvent> = {}
  ): Promise<string[]> {
    const before = this.transport.sent.length;
    const response = await this.post(this.message(person, { text, ...fields }));
    if (response.status >= 400) throw new Error(`Ingress rejected the event: ${response.status}`);
    await this.drain();
    return this.transport.sent.slice(before).map((request) => request.message.text);
  }

  /** Presses a button on the most recent message that offered one with this label. */
  async press(person: Person, label: string): Promise<string[]> {
    const request = [...this.transport.sent]
      .reverse()
      .find((sent) => sent.message.choices?.some((choice) => choice.label === label));
    const choice = request?.message.choices?.find((candidate) => candidate.label === label);
    if (!choice) throw new Error(`No button labelled ${label}`);
    return this.say(person, label, { replyId: choice.id });
  }

  close(): void {
    this.core.db.close();
    rmSync(this.dir, { recursive: true, force: true });
  }
}

/** Reads the confirmation token from the latest summary so tests confirm exactly what was shown. */
export function summaryToken(texts: readonly string[]): string {
  const token = [...texts]
    .reverse()
    .map((text) => /CONFIRM (\d{4})/.exec(text)?.[1])
    .find(Boolean);
  if (!token) throw new Error("No summary token was sent");
  return token;
}
