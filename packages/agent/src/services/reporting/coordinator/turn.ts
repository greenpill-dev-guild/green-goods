import { outstandingRequirements } from "@green-goods/shared/modules/agent-reporting";
import type { Address } from "@green-goods/shared/types/domain";
import type { CatalogResult, ReportingCatalog } from "../catalog";
import { accountAwaitingPair } from "../channel-pairing";
import { inTransaction } from "../database";
import {
  consumeInboxEvent,
  deferInboxEvent,
  type InboxEventRow,
  nextConversationEvent,
} from "../inbox";
import {
  findGarden,
  type GardenScope,
  gardenScope,
  gardensIn,
  type ReportingGarden,
  soleGarden,
} from "../gardens";
import {
  type InterpretationResult,
  interpretWithDeadline,
  type ReportInterpreter,
} from "../interpretation";
import {
  acquireConversationLease,
  type ConversationLease,
  holdsLease,
  releaseConversationLease,
} from "../leases";
import type { ReportingCore } from "../runtime";
import {
  answerConnectionOffer,
  answerGrantChoice,
  confirmPublication,
  disconnectAccount,
  handlePairing,
  requestConnection,
  welcome,
} from "./account-steps";
import type { ChatCommand } from "./commands";
import {
  answerConsent,
  answerVoiceConsent,
  sendConsentNotice,
  withdrawProcessing,
} from "./consent-step";
import { loadTurnContext, planTurn, type TurnContext, type TurnPlan } from "./context";
import { StaleDraftError } from "./draft-commit";
import { answeredGarden, asksToLookAgain, readOwnGardens } from "./garden-step";
import { handleReportAnswer } from "./report-answer";
import { confirmDraft, handleReportCommand } from "./report-commands";
import { handleReportMessage } from "./report-message";
import { gardenToDrop, type TurnExternal } from "./report-work";
import { isReviewPrompt, nextReviewStep } from "./review-prompts";
import {
  answerReviewPrompt,
  answerReviewSelection,
  handleReviewCommand,
  requestReview,
} from "./review-steps";
import { startRecovery } from "../recovery";
import { StaleReviewError } from "../reviews";
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

const commandOf = (plan: TurnPlan) => (plan.kind === "command" ? plan.command.kind : null);

/**
 * The account a turn runs as: the one linked to its chat, or the one its pairing code is about to
 * link. The code is only read here; the turn itself decides whether the pairing stands.
 */
function turnAccount(core: ReportingCore, ctx: TurnContext, plan: TurnPlan): Address | null {
  const pairing =
    plan.kind === "command" && plan.command.kind === "pair" && ctx.binding
      ? accountAwaitingPair(core, ctx.subjectId, ctx.binding.participantId, plan.command.code)
      : null;
  return pairing ?? ctx.account?.address ?? null;
}

/** The garden whose activities a turn may need: the one its report will name when it ends. */
function reportGarden(
  core: ReportingCore,
  ctx: TurnContext,
  plan: TurnPlan,
  scope: GardenScope,
  account: Address | null
): ReportingGarden | null {
  if (plan.kind === "answer" && plan.prompt.kind === "select_garden") {
    const answered = answeredGarden(scope, plan.prompt, plan.option, plan.text);
    if (answered) return answered;
  }
  // Pairing takes a garden the new account does not report to off the report.
  const dropped = commandOf(plan) === "pair" && gardenToDrop(core.gardens, ctx.draft, account);
  const address = dropped ? null : ctx.draft?.content.garden?.address;
  return address ? findGarden(core.gardens, address) : soleGarden(scope);
}

/**
 * The commands whose reply can show or use a report's gardens or activities: linking an account,
 * the garden step's own words, and CONFIRM, which puts the open question again when no summary is
 * showing. Every other command, STOP, DELETE and HELP among them, is answered without waiting on
 * the indexer.
 */
const REPORT_COMMANDS = new Set<ChatCommand["kind"]>([
  "pair",
  "connect",
  "start",
  "garden",
  "join",
  "confirm",
]);

/** A report's questions that offer a list of choices. */
const REPORT_CHOICES = new Set([
  "select_garden",
  "select_action",
  "field",
  "time_unit",
  "conflict",
  "edit_field",
]);

/**
 * Typed words sent to a report's list of choices that are neither numbers nor one of the choices'
 * own labels; null for anything else. A garden or activity named in other words still lands here,
 * and the answer handler tries its own matching before it turns to what the model read.
 */
function offChoiceText(plan: TurnPlan): string | null {
  if (plan.kind !== "answer" || plan.option !== null) return null;
  const { prompt } = plan;
  if (!REPORT_CHOICES.has(prompt.kind) || prompt.options.length === 0) return null;
  const text = plan.text?.trim();
  if (!text) return null;
  const said = text.toLowerCase();
  const numbers = said.split(/[\s,;]+/u).every((part) => /^\d+$/u.test(part));
  const label = prompt.options.some((choice) => choice.label.toLowerCase() === said);
  return numbers || label ? null : text;
}

async function gatherExternal(
  deps: CoordinatorDeps,
  ctx: TurnContext,
  plan: TurnPlan
): Promise<TurnExternal> {
  const { core } = deps;
  const activitiesOf = (place: ReportingGarden): Promise<CatalogResult> =>
    deps.catalog
      .eligibleActions(place, core.clock.now())
      .catch((): CatalogResult => ({ ok: false, reason: "unavailable" }));
  const account = turnAccount(core, ctx, plan);
  // A tap on a button of an earlier question puts the report's open question again.
  const reasks = plan.kind === "stale_reply" && ctx.draft !== null;
  const reportPlan =
    plan.kind === "message" ||
    plan.kind === "answer" ||
    (plan.kind === "command" && REPORT_COMMANDS.has(plan.command.kind)) ||
    reasks;
  // Any of these may show or use a linked account's gardens: the garden question and its
  // answers, a garden a model reads in a correction, a reply that names them.
  if (account && reportPlan) {
    // A reply that puts a garden question with no garden to offer again is asking to look again,
    // whether it answers that question or taps a button of an earlier one.
    const lookAgain =
      (plan.kind === "answer" || reasks) && ctx.prompt !== null && asksToLookAgain(ctx.prompt);
    await readOwnGardens(core, lookAgain);
  }
  const scope = gardenScope(core.gardens, account);
  let garden = reportGarden(core, ctx, plan, scope, account);
  // The activities are read whenever the reply may have to offer them: while the report has
  // still to choose one, which a changed garden asks of it again, and for any answer.
  const draft = ctx.draft;
  const choosing =
    !draft ||
    outstandingRequirements(draft.content, draft.snapshot).some((need) => need.kind === "action");
  // A report that is about to name another garden has to choose its activity again.
  const changing = garden?.address !== draft?.content.garden?.address;
  const needsCatalog =
    garden !== null && reportPlan && (choosing || plan.kind === "answer" || changing);
  let result: CatalogResult | null = garden && needsCatalog ? await activitiesOf(garden) : null;
  let interpretation: InterpretationResult | null = null;
  // A story or correction is read by the model, and so are words sent to a list of choices that
  // pick none of them: they may be a question, a correction or the answer in other words.
  const said = plan.kind === "message" ? plan.text : offChoiceText(plan);
  if (said && ctx.modelEnabled && ctx.binding) {
    const content = ctx.draft?.content;
    interpretation = await interpretWithDeadline(
      deps.interpreter,
      {
        locale: ctx.locale,
        draftRevision: ctx.draft?.revision ?? 0,
        message: { sourceEntryId: ctx.event.id, text: said },
        content: {
          actionUID: content?.actionUID ?? null,
          title: content?.title ?? null,
          timeSpentMinutes: content?.timeSpentMinutes ?? null,
          feedback: content?.feedback ?? null,
          details: content?.details ?? {},
        },
        requirements: content ? outstandingRequirements(content, ctx.draft?.snapshot ?? null) : [],
        gardens: gardensIn(scope).map((candidate) => ({
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
    // A garden the model read for a report that has none yet: its activities are read in this
    // turn too, so the reply can ask which activity instead of failing to list them.
    const named = gardensIn(scope).find((candidate) => candidate.key === interpretation?.gardenKey);
    if (named && !garden && !ctx.draft?.content.garden) {
      garden = named;
      result = await activitiesOf(named);
    }
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
    case "suspended":
      writer.say("recovery.suspended");
      return "consume";
    case "stale_reply":
      if (writer.ctx.draft)
        handleReportMessage(writer, { kind: "message", text: null, media: [] }, external);
      return "consume";
    case "answer":
      if (plan.prompt.kind === "select_review_work") {
        answerReviewSelection(writer, plan);
      } else if (isReviewPrompt(plan.prompt.kind) && writer.ctx.review) {
        answerReviewPrompt(writer, writer.ctx.review, plan);
      } else if (plan.prompt.kind === "publication_consent" && plan.option) {
        confirmPublication(writer, null, true);
      } else if (plan.prompt.kind === "voice_consent" && plan.option) {
        answerVoiceConsent(writer, plan.option.value);
        // Declining re-asks the report's open question; agreeing replies once transcribed.
        if (plan.option.value !== "agree" && writer.ctx.draft)
          handleReportMessage(writer, { kind: "message", text: null, media: [] }, external);
      } else if (plan.prompt.kind === "grant_choice" && plan.option) {
        answerGrantChoice(writer, plan.option.value);
      } else if (plan.prompt.kind === "join_community") {
        // Its one choice reads the account's role again, and so does any other reply: the report
        // is waiting on nothing else.
        handleReportCommand(writer, { kind: "retry" }, external);
      } else if (plan.prompt.kind === "connect_offer") {
        answerConnectionOffer(writer, plan.option !== null);
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
    case "message": {
      const { review, prompt, account } = writer.ctx;
      // While a decision question is open, free text re-asks it instead of starting a report.
      if (review && account && isReviewPrompt(prompt?.kind) && plan.media.length === 0) {
        nextReviewStep(writer, review, account.address);
        return "consume";
      }
      handleReportMessage(writer, plan, external);
      return "consume";
    }
    case "command":
      routeCommand(deps, writer, plan, external);
      return "consume";
  }
}

function routeCommand(
  deps: CoordinatorDeps,
  writer: TurnWriter,
  plan: Extract<TurnPlan, { kind: "command" }>,
  external: TurnExternal
): void {
  const { command } = plan;
  const { review } = writer.ctx;
  if (command.kind === "stop" || command.kind === "delete")
    return withdrawProcessing(writer, command.kind);
  if (command.kind === "pair") return handlePairing(writer, command.code, external);
  if (command.kind === "connect") return requestConnection(writer, command.account);
  if (command.kind === "disconnect" || command.kind === "switch")
    return disconnectAccount(writer, command.kind === "switch");
  if (command.kind === "publish") return confirmPublication(writer, command.token, false);
  if (command.kind === "start" && startsIdle(writer)) return welcome(writer);
  if (command.kind === "help" || command.kind === "start") return writer.say("help");
  if (command.kind === "review") return requestReview(writer, command.index);
  if (command.kind === "recover") return startRecovery(writer);
  if (review && reviewOwnsCommand(writer) && handleReviewCommand(writer, review, command)) return;
  const owned = deps.commands?.[command.kind];
  if (owned) return owned(writer, plan);
  handleReportCommand(writer, command, external);
}

/** START welcomes, and offers to link an account, only while nothing else is under way. */
function startsIdle(writer: TurnWriter): boolean {
  const { binding, draft, review } = writer.ctx;
  return Boolean(binding) && !draft && !review;
}

/** Commands such as CONFIRM or CANCEL belong to an open decision while its question is showing. */
function reviewOwnsCommand(writer: TurnWriter): boolean {
  const { review, prompt, draft } = writer.ctx;
  return Boolean(review && (isReviewPrompt(prompt?.kind) || !draft));
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
        now.review?.id !== ctx.review?.id ||
        now.review?.revision !== ctx.review?.revision ||
        now.prompt?.id !== ctx.prompt?.id
      ) {
        throw new StaleDraftError();
      }
      const writer = new TurnWriter(core, ctx);
      finalizeEvent(core, event, applyTurn(deps, writer, plan, external));
      return "committed" as const;
    });
  } catch (error) {
    if (error instanceof StaleDraftError || error instanceof StaleReviewError) return "stale";
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
  const seen = new Map<string, number>();
  try {
    for (;;) {
      const event = nextConversationEvent(core, conversationId);
      if (!event) break;
      // A turn must move its event on; one that keeps coming back is parked, not spun on.
      const visits = (seen.get(event.id) ?? 0) + 1;
      seen.set(event.id, visits);
      if (visits > MAX_REPLANS) {
        inTransaction(core.db, () => deferInboxEvent(core, event.id, "turn_repeated", 60_000));
        return committed;
      }
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
