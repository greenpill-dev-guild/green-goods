import type { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import * as z from "zod";
import { ensureControls, type ControlName } from "../../../services/reporting/controls";
import { openReportingDatabase } from "../../../services/reporting/database";
import { acceptInboundEvent } from "../../../services/reporting/inbox";
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
import {
  AIYELOJA,
  FixtureCatalog,
  FixtureInterpreter,
  ManualClock,
  RecordingTransport,
  SequentialIds,
  TAS,
  TEST_KEYS,
} from "./fixtures";

/** Synthetic ingress exists only in test and dev-driver composition, never in `createServer`. */
const SYNTHETIC_REALM = /^(synthetic|telegram-fixture|whatsapp-fixture):[a-z0-9-]+$/;

const EventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("message"),
    providerRealm: z.string().regex(SYNTHETIC_REALM),
    eventId: z.string().min(1).max(128),
    providerMessageId: z.string().min(1).max(128),
    chat: z.object({
      externalChatId: z.string().min(1),
      threadId: z.string().optional(),
      kind: z.enum(["direct", "group"]),
    }),
    sender: z.object({ externalSubjectId: z.string().min(1) }),
    sentAt: z.number().int(),
    text: z.string().max(4_000).optional(),
    replyId: z.string().max(200).optional(),
    media: z
      .array(
        z.object({
          providerMediaId: z.string(),
          declaredMime: z.string().optional(),
          declaredName: z.string().optional(),
          declaredSize: z.number().optional(),
        })
      )
      .max(10)
      .optional(),
    locale: z.string().max(10).optional(),
  }),
  z.object({
    kind: z.literal("delivery_status"),
    providerRealm: z.string().regex(SYNTHETIC_REALM),
    eventId: z.string().min(1).max(128),
    providerMessageId: z.string().min(1),
    status: z.enum(["sent", "delivered", "read", "failed"]),
    errorCode: z.string().optional(),
    occurredAt: z.number().int(),
  }),
]);

export function mountSyntheticIngress(app: Hono, core: () => ReportingCore): void {
  app.post("/__synthetic/events", async (c) => {
    const parsed = EventSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid_event" }, 400);
    const result = acceptInboundEvent(core(), parsed.data as NormalizedInboundEvent);
    return c.json(result, result.status === "accepted" ? 202 : 200);
  });
}

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
  core: ReportingCore;
  private eventCounter = 0;

  constructor(private readonly options: HarnessOptions = {}) {
    this.core = this.open();
    ensureControls(this.core, {
      intake: true,
      model_processing: false,
      publication: true,
      outbound_messages: true,
      ...options.controls,
    });
    mountSyntheticIngress(this.app, () => this.core);
  }

  private open(): ReportingCore {
    const db: Database = openReportingDatabase(join(this.dir, "reporting.db"));
    return {
      db,
      keyring: createReportingKeyring(TEST_KEYS),
      clock: this.clock,
      ids: this.ids,
      settings: {
        ...DEFAULT_REPORTING_SETTINGS,
        chainId: 42161,
        browserOrigin: "https://greengoods.test",
        gardens: [TAS, AIYELOJA],
        ...this.options.settings,
      },
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
      jobs: { ...this.options.jobs?.(this), ...jobs },
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
