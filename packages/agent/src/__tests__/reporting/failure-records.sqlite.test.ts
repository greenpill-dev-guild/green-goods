import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueJob } from "../../services/reporting/jobs";
import { participantWriter } from "../../services/reporting/notify";
import { tick } from "../../services/reporting/worker";
import { initAgentSentry, resetAgentSentryForTests } from "../../services/sentry";
import { ADA, Harness } from "./support/harness";

/**
 * A reporting job that fails, a chat message that is not delivered and a background reply with
 * nobody to address each leave a record, on real SQLite through the real worker and outbox. Pino
 * and the Sentry SDK are recorders, so the test reads exactly what would be logged and reported.
 */
const recorded = vi.hoisted(() => {
  const lines: Array<{ level: string; message: string; fields: Record<string, unknown> }> = [];
  const logger = (bindings: Record<string, unknown>): Record<string, unknown> => {
    const write = (level: string) => (first: unknown, message?: string) =>
      typeof first === "string"
        ? lines.push({ level, message: first, fields: bindings })
        : lines.push({
            level,
            message: message ?? "",
            fields: { ...bindings, ...(first as object) },
          });
    return {
      ...Object.fromEntries(
        ["trace", "debug", "info", "warn", "error", "fatal"].map((level) => [level, write(level)])
      ),
      child: (more: Record<string, unknown>) => logger({ ...bindings, ...more }),
    };
  };
  const scope = { setTag: vi.fn(), setContext: vi.fn() };
  const sentry = {
    init: vi.fn(),
    setTag: vi.fn(),
    captureException: vi.fn(),
    flush: vi.fn(async () => true),
    withScope: vi.fn((callback: (current: typeof scope) => void) => callback(scope)),
  };
  return { lines, logger, scope, sentry };
});

vi.mock("pino", () => ({ default: () => recorded.logger({}) }));
vi.mock("@sentry/bun", () => recorded.sentry);

let harness: Harness;

beforeEach(() => {
  recorded.lines.length = 0;
  vi.clearAllMocks();
  initAgentSentry({ dsn: "https://key@sentry.invalid/1", enabled: true, tracesSampleRate: 0 });
  harness = new Harness();
});

afterEach(() => {
  resetAgentSentryForTests();
  harness.close();
});

/** The fields of each reporting line at this level with this message, in order. */
function logged(level: string, message: string): Array<Record<string, unknown>> {
  return recorded.lines
    .filter((line) => line.level === level && line.message === message)
    .map(({ fields: { context, ...fields } }) => {
      expect(context).toBe("reporting");
      return fields;
    });
}

function expectErrorEvent(message: string, source: string, metadata: Record<string, unknown>) {
  expect(recorded.sentry.captureException).toHaveBeenCalledOnce();
  expect(recorded.sentry.captureException).toHaveBeenCalledWith(
    expect.objectContaining({ message })
  );
  expect(recorded.scope.setTag).toHaveBeenCalledWith("green_goods.source", source);
  expect(recorded.scope.setTag).toHaveBeenCalledWith("green_goods.surface", "reporting");
  expect(recorded.scope.setContext).toHaveBeenCalledWith(
    "green_goods_agent",
    expect.objectContaining({ metadata })
  );
}

describe("a reporting job that fails", () => {
  it("warns that a thrown job will try again, naming its kind, code and attempt but not the error", async () => {
    enqueueJob(harness.core, {
      kind: "retention_sweep",
      subjectId: "sweep",
      dedupeKey: "sweep",
      maxAttempts: 3,
    });
    await tick(
      harness.deps({
        retention_sweep: async () => {
          throw new TypeError(
            "https://rpc.example/v2/secret refused 0x00000000000000000000000000000000000000aa"
          );
        },
      })
    );

    expect(logged("warn", "Reporting job will try again")).toEqual([
      {
        kind: "retention_sweep",
        errorCode: "TypeError",
        attempt: 1,
        maxAttempts: 3,
        retryInMs: 30_000,
      },
    ]);
    expect(JSON.stringify(recorded.lines)).not.toMatch(/rpc\.example|0x0{38}aa/);
    expect(recorded.sentry.captureException).not.toHaveBeenCalled();
  });

  it("records an error and an error event once a job spends its last attempt", async () => {
    enqueueJob(harness.core, {
      kind: "reconcile_operation",
      subjectId: "operation",
      dedupeKey: "operation",
      maxAttempts: 2,
    });
    const deps = harness.deps({
      reconcile_operation: async () => ({
        status: "retry",
        errorCode: "receipt_pending",
        delayMs: 30_000,
      }),
    });
    await tick(deps);
    harness.clock.advance(30_000);
    await tick(deps);

    const spent = {
      kind: "reconcile_operation",
      errorCode: "receipt_pending",
      attempt: 2,
      maxAttempts: 2,
    };
    expect(logged("error", "Reporting job ran out of attempts")).toEqual([spent]);
    expectErrorEvent("Reporting job ran out of attempts", "reporting.worker", spent);
    expect(harness.core.db.query("SELECT state FROM processing_jobs").get()).toEqual({
      state: "failed",
    });
  });
});

describe("a chat message that is not delivered", () => {
  it("warns while it waits and records an error and an error event once it gives up", async () => {
    harness.close();
    harness = new Harness({ settings: { maxOutboxAttempts: 2 } });
    harness.transport.script = [
      { status: "retryable", errorCode: "rate_limited", retryAfterMs: 1_000 },
      { status: "retryable", errorCode: "rate_limited" },
    ];
    await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");

    expect(logged("warn", "Chat message not delivered; trying again")).toEqual([
      {
        replyKind: "prompt:processing_consent",
        errorCode: "rate_limited",
        attempt: 1,
        maxAttempts: 2,
        retryInMs: 1_000,
      },
    ]);
    expect(recorded.sentry.captureException).not.toHaveBeenCalled();

    harness.clock.advance(1_000);
    await harness.drain();

    const undelivered = {
      replyKind: "prompt:processing_consent",
      errorCode: "rate_limited",
      attempt: 2,
      maxAttempts: 2,
    };
    expect(logged("error", "Chat message could not be delivered")).toEqual([undelivered]);
    expectErrorEvent("Chat message could not be delivered", "reporting.outbox", undelivered);
    expect(harness.transport.sent).toEqual([]);
    expect(harness.core.db.query("SELECT state FROM delivery_outbox").get()).toEqual({
      state: "terminal_failed",
    });
    expect(JSON.stringify(recorded.lines)).not.toMatch(/baobab|agree/i);
  });
});

describe("a background reply with nobody to address", () => {
  it("warns why and what the reply was for, without the ids behind it", async () => {
    const core = () => harness.core;
    const noRecipient = () => logged("warn", "No live recipient in a participant's conversation");

    // Nobody has written in this conversation.
    expect(
      participantWriter(core(), {
        participantId: "id-90001",
        conversationId: "id-90002",
        dedupePrefix: "prepare:id-90003",
      })
    ).toBeNull();

    // Ada has written but not agreed to processing, so no participant is bound to her yet.
    await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
    const { id: conversationId } = core().db.query("SELECT id FROM conversations").get() as {
      id: string;
    };
    expect(
      participantWriter(core(), {
        participantId: "id-90001",
        conversationId,
        dedupePrefix: "subject",
      })
    ).toBeNull();

    // Once she agrees, her binding names her own participant, not this one.
    await harness.press(ADA, "I agree");
    expect(
      participantWriter(core(), {
        participantId: "id-90001",
        conversationId,
        dedupePrefix: "id-90003",
      })
    ).toBeNull();
    const { id: participantId } = core().db.query("SELECT id FROM participants").get() as {
      id: string;
    };
    expect(
      participantWriter(core(), { participantId, conversationId, dedupePrefix: "subject" })
    ).not.toBeNull();

    expect(noRecipient()).toEqual([
      { reason: "no_sender", purpose: "prepare" },
      { reason: "no_binding", purpose: "subject" },
      { reason: "binding_moved", purpose: "other" },
    ]);
    expect(JSON.stringify(recorded.lines)).not.toContain("id-9000");
  });
});
