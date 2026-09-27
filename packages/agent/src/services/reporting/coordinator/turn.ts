import { outstandingRequirements } from "@green-goods/shared/modules/agent-reporting";
import type { CatalogResult, ReportingCatalog } from "../catalog";
import { inTransaction } from "../database";
import {
  consumeInboxEvent,
  deferInboxEvent,
  type InboxEventRow,
  nextConversationEvent,
} from "../inbox";
import { interpretWithDeadline, type ReportInterpreter } from "../interpretation";
import {
  acquireConversationLease,
  type ConversationLease,
  holdsLease,
  releaseConversationLease,
} from "../leases";
import type { EnabledGarden, ReportingCore } from "../runtime";
import { answerGrantChoice, confirmPublication, handlePairing } from "./account-steps";
import { answerConsent, sendConsentNotice, withdrawProcessing } from "./consent-step";
import { loadTurnContext, planTurn, type TurnContext, type TurnPlan } from "./context";
import { StaleDraftError } from "./draft-commit";
import { handleReportAnswer } from "./report-answer";
import { confirmDraft, handleReportCommand } from "./report-commands";
import { handleReportMessage } from "./report-message";
import type { TurnExternal } from "./report-work";
import { TurnWriter } from "./writer";

/**
 * The durable coordinator every transport feeds. One leased worker handles a conversation's
 * events in arrival order. Each turn reads state, makes bounded external calls outside any
 * transaction, then commits the transition, the consumed event and its reply intents together,
 * but only while its lease fence and the draft revision it read are still current. A stale result
 * is discarded and the event replanned against the newer revision; it is never marked consumed.
 */
export interface CoordinatorDeps {
  core: ReportingCore;
  catalog: ReportingCatalog;
  interpreter: ReportInterpreter | null;
  interpretationTimeoutMs: number;
  /** Handles commands owned by other flows (pairing, review, recovery). */
  commands?: Partial<
    Record<string, (writer: TurnWriter, plan: Extract<TurnPlan, { kind: "command" }>) => void>
  >;
}

const MAX_REPLANS = 3;
const PAUSE_RETRY_MS = 5 * 60 * 1000;

function catalogGarden(
  core: ReportingCore,
  ctx: TurnContext,
  plan: TurnPlan
): EnabledGarden | null {
  const gardens = core.settings.gardens;
  if (plan.kind === "answer" && plan.prompt.kind === "select_garden") {
    const key = plan.option?.value ?? plan.prompt.options[Number(plan.text) - 1]?.value;
    return gardens.find((garden) => garden.key === key) ?? null;
  }
  const address = ctx.draft?.content.garden?.address;
  if (address)
    return gardens.find((garden) => garden.address.toLowerCase() === address.toLowerCase()) ?? null;
  return gardens.length === 1 ? (gardens[0] as EnabledGarden) : null;
}

async function gatherExternal(
  deps: CoordinatorDeps,
  ctx: TurnContext,
  plan: TurnPlan
): Promise<TurnExternal> {
  const garden = catalogGarden(deps.core, ctx, plan);
  const reportPlan = plan.kind === "message" || plan.kind === "answer" || plan.kind === "command";
  const needsCatalog =
    Boolean(garden) && reportPlan && (!ctx.draft?.snapshot || plan.kind === "answer");
  const result: CatalogResult | null =
    garden && needsCatalog
      ? await deps.catalog
          .eligibleActions(garden, deps.core.clock.now())
          .catch((): CatalogResult => ({ ok: false, reason: "unavailable" }))
      : null;
  let interpretation = null;
  if (plan.kind === "message" && plan.text && ctx.modelEnabled && ctx.binding) {
    const content = ctx.draft?.content;
    interpretation = await interpretWithDeadline(
      deps.interpreter,
      {
        locale: ctx.locale,
        draftRevision: ctx.draft?.revision ?? 0,
        message: { sourceEntryId: ctx.event.id, text: plan.text },
        content: {
          actionUID: content?.actionUID ?? null,
          title: content?.title ?? null,
          timeSpentMinutes: content?.timeSpentMinutes ?? null,
          feedback: content?.feedback ?? null,
          details: content?.details ?? {},
        },
        requirements: content ? outstandingRequirements(content, ctx.draft?.snapshot ?? null) : [],
        gardens: deps.core.settings.gardens.map((candidate) => ({
          key: candidate.key,
          label: candidate.label,
        })),
        actions: result?.ok
          ? result.actions.map((action) => ({
              uid: action.definition.actionUID,
              title: action.definition.title,
              inputs: action.definition.inputs,
            }))
          : [],
        observations: [],
      },
      deps.interpretationTimeoutMs
    );
  }
  return { catalog: { garden, result }, interpretation };
}

type TurnOutcome = "consume" | "hold" | "pause";

function applyTurn(
  deps: CoordinatorDeps,
  writer: TurnWriter,
  plan: TurnPlan,
  external: TurnExternal
): TurnOutcome {
  switch (plan.kind) {
    case "consent_notice":
      sendConsentNotice(writer);
      return "hold";
    case "hold":
      return "hold";
    case "consent_answer":
      answerConsent(writer, plan.answer);
      return "consume";
    case "held_by_pause":
      writer.say("intake.paused");
      return "pause";
    case "stale_reply":
      if (writer.ctx.draft)
        handleReportMessage(writer, { kind: "message", text: null, media: [] }, external);
      return "consume";
    case "answer":
      if (plan.prompt.kind === "publication_consent" && plan.option) {
        confirmPublication(writer, null, true);
      } else if (plan.prompt.kind === "grant_choice" && plan.option) {
        answerGrantChoice(writer, plan.option.value);
      } else if (plan.prompt.kind === "confirm_report" && plan.option) {
        if (plan.option.value === "confirm") confirmDraft(writer, null, true, external);
        else
          handleReportCommand(
            writer,
            { kind: plan.option.value === "edit" ? "edit" : "cancel" },
            external
          );
      } else {
        handleReportAnswer(writer, plan, external);
      }
      return "consume";
    case "message":
      handleReportMessage(writer, plan, external);
      return "consume";
    case "command": {
      const { command } = plan;
      if (command.kind === "stop" || command.kind === "delete")
        withdrawProcessing(writer, command.kind);
      else if (command.kind === "pair") handlePairing(writer, command.code);
      else if (command.kind === "publish") confirmPublication(writer, command.token, false);
      else if (command.kind === "help" || command.kind === "start") writer.say("help");
      else if (deps.commands?.[command.kind]) deps.commands[command.kind]?.(writer, plan);
      else handleReportCommand(writer, command, external);
      return "consume";
    }
  }
}

function finalizeEvent(core: ReportingCore, event: InboxEventRow, outcome: TurnOutcome): void {
  if (outcome === "consume") consumeInboxEvent(core, event.id);
  else if (outcome === "pause") {
    core.db
      .query("UPDATE inbox_events SET next_attempt_at = $next WHERE id = $id")
      .run({ id: event.id, next: core.clock.now() + PAUSE_RETRY_MS });
  } else {
    // Quarantined until consent releases it or the pre-consent window expires.
    core.db
      .query(
        "UPDATE inbox_events SET state = 'quarantined', next_attempt_at = COALESCE(expires_at, $far) WHERE id = $id"
      )
      .run({ id: event.id, far: core.clock.now() + core.settings.preConsentRetentionMs });
  }
}

type CommitResult = "committed" | "stale" | "fenced" | "gone";

async function runTurn(
  deps: CoordinatorDeps,
  lease: ConversationLease,
  event: InboxEventRow
): Promise<CommitResult> {
  const { core } = deps;
  const ctx = loadTurnContext(core, event);
  if (!ctx) {
    inTransaction(core.db, () => consumeInboxEvent(core, event.id));
    return "gone";
  }
  const plan = planTurn(ctx);
  const external = await gatherExternal(deps, ctx, plan);
  try {
    return inTransaction(core.db, () => {
      if (!holdsLease(core, lease)) return "fenced" as const;
      const now = loadTurnContext(core, event);
      if (
        !now ||
        now.draft?.id !== ctx.draft?.id ||
        now.draft?.revision !== ctx.draft?.revision ||
        now.prompt?.id !== ctx.prompt?.id
      ) {
        throw new StaleDraftError();
      }
      const writer = new TurnWriter(core, ctx);
      finalizeEvent(core, event, applyTurn(deps, writer, plan, external));
      return "committed" as const;
    });
  } catch (error) {
    if (error instanceof StaleDraftError) return "stale";
    throw error;
  }
}

/** Processes a conversation's pending events under one lease. Returns the number of turns committed. */
export async function processConversation(
  deps: CoordinatorDeps,
  conversationId: string,
  workerId: string
): Promise<number> {
  const { core } = deps;
  const lease = inTransaction(core.db, () =>
    acquireConversationLease(core, conversationId, workerId)
  );
  if (!lease) return 0;
  let committed = 0;
  try {
    for (;;) {
      const event = nextConversationEvent(core, conversationId);
      if (!event) break;
      let result: CommitResult = "stale";
      for (let attempt = 0; attempt < MAX_REPLANS && result === "stale"; attempt += 1) {
        try {
          result = await runTurn(deps, lease, event);
        } catch (error) {
          inTransaction(core.db, () => deferInboxEvent(core, event.id, errorCode(error), 30_000));
          return committed;
        }
      }
      if (result === "fenced") return committed;
      if (result === "stale") {
        inTransaction(core.db, () => deferInboxEvent(core, event.id, "stale_revision", 1_000));
        return committed;
      }
      committed += 1;
    }
  } finally {
    inTransaction(core.db, () => releaseConversationLease(core, lease));
  }
  return committed;
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.name.slice(0, 64) || "turn_failed" : "turn_failed";
}
