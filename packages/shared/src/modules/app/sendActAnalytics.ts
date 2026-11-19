/**
 * Send act records (PRD-1553)
 *
 * Every act that signs or sends records when it started and how it ended, so a
 * send that stalls still leaves a trace. One pair of events serves every act:
 * `send_act_started`, then one `send_act_ended` carrying the act's `outcome`.
 * Work submissions, approvals and member changes keep their own events.
 *
 * The records carry no address, hash, amount, or text a person typed or an
 * error message holds: only the act's name, which of its operations ran (a
 * fixed name from code), the sign-in kind, the chain, how long it took, and for
 * an act that did not land, the parsed error family.
 *
 * @module modules/app/sendActAnalytics
 */

import { parseContractError } from "../../utils/errors/contract-errors";
import {
  classifyTxError,
  hasErrorName,
  isHeldByAnotherSend,
} from "../../utils/errors/tx-error-classifier";
import type { AuthMode } from "./analytics-events";
import { logger } from "./logger";
import { track } from "./posthog";

const SEND_ACT_STARTED = "send_act_started";
const SEND_ACT_ENDED = "send_act_ended";

/** The acts that sign or send, by the name a PostHog breakdown reads. */
type SendActName =
  // Joining and claiming
  | "garden_join"
  | "commitment"
  | "greenwill_badge_claim"
  // Vault, yield and token sends
  | "token_send"
  | "eth_wrap"
  | "vault_deposit"
  | "vault_withdraw"
  | "vault_endow"
  | "vault_harvest"
  | "vault_auto_allocate"
  | "vault_emergency_pause"
  | "yield_allocate"
  | "cookie_jar_deposit"
  | "cookie_jar_withdraw"
  | "cookie_jar_admin"
  // Garden creation and settings
  | "garden_create"
  | "garden_update"
  | "action_edit"
  // The Hub's pool and season acts
  | "pool_lifecycle"
  | "pool_setup"
  | "pool_finish_creating"
  | "pool_seed"
  | "pool_group_add"
  | "pool_reward_edit"
  | "pool_confirmer_edit"
  | "pool_protocol_funding"
  | "pool_settlement"
  | "pool_credit"
  | "pool_service_access"
  | "pool_service_issuer"
  | "pool_voucher_award"
  // Conviction voting
  | "conviction";

/**
 * How an act ended.
 *
 * - `confirmed`: it landed.
 * - `confirming`: the send went out and may still land, so it is not a failure:
 *   a receipt wait that ran past its limit, or a send on record with no receipt.
 * - `queued`: kept on this device to send later.
 * - `cancelled`: the person declined the prompt.
 * - `failed`: anything else; nothing says it landed.
 * - `partial`: an act of several copies whose copies ended differently; its
 *   `copies_*` counts say how many ended each way.
 */
export type SendActOutcome =
  | "confirmed"
  | "confirming"
  | "queued"
  | "cancelled"
  | "failed"
  | "partial";

/** How one copy of a several-copy act ended. */
export type SendActCopyOutcome = Exclude<SendActOutcome, "partial">;

/**
 * An ending its act's result describes: the outcome, the parsed error family of
 * a run that stopped on an error, and for an act of several copies, how many
 * copies ended each way.
 */
export interface SendActEndingDetail {
  outcome: SendActOutcome;
  parsedErrorFamily?: string;
  copies?: Partial<Record<SendActCopyOutcome, number>>;
}

export interface SendActContext {
  act: SendActName;
  /** Which of the act's operations ran: a fixed name from code, never a person's words. */
  operation?: string;
  authMode: AuthMode | undefined;
  chainId?: number;
}

const OPTIONS = { includeSessionId: false };

/**
 * Viem's own timeouts already read as unconfirmed. A sender's own receipt limit
 * says the same, and so does a wallet whose answer the person stopped waiting
 * for (PRD-1551): the wallet may still send it.
 */
const STILL_CONFIRMING_NAMES: ReadonlySet<string> = new Set([
  "ReceiptWaitLimitError",
  "WalletAnswerAbandonedError",
]);

/**
 * Sends a sender handed back with no receipt (`confirmation: "pending"`, such as
 * a Safe proposal), by hash, so an act that keeps only the hash still ends as
 * confirming. Held in memory, read once, and never sent anywhere.
 */
const unconfirmedHashes = new Set<string>();
const UNCONFIRMED_HASHES_KEPT = 64;

export function noteUnconfirmedSend(result: unknown): void {
  const { hash, confirmation } = (result ?? {}) as { hash?: unknown; confirmation?: unknown };
  if (confirmation !== "pending" || typeof hash !== "string") return;
  unconfirmedHashes.add(hash.toLowerCase());
  if (unconfirmedHashes.size > UNCONFIRMED_HASHES_KEPT)
    unconfirmedHashes.delete(unconfirmedHashes.values().next().value as string);
}

/** How an act that threw ended, and the parsed error family it carries (never its message). */
export function sendActEnding(error: unknown): {
  outcome: Extract<SendActOutcome, "confirming" | "cancelled" | "failed">;
  parsedErrorFamily: string;
} {
  // Refused before sending: the earlier send that holds the same thing keeps its own record.
  if (isHeldByAnotherSend(error))
    return { outcome: "failed", parsedErrorFamily: "HeldByAnotherSend" };
  const parsedErrorFamily = parseContractError(error).name;
  if (hasErrorName(error, STILL_CONFIRMING_NAMES))
    return { outcome: "confirming", parsedErrorFamily };
  const kind = classifyTxError(error).kind;
  if (kind === "unconfirmed") return { outcome: "confirming", parsedErrorFamily };
  if (kind === "cancelled") return { outcome: "cancelled", parsedErrorFamily };
  return { outcome: "failed", parsedErrorFamily };
}

/**
 * A batched save's ending. `unknown` may have landed and is held until someone
 * reads it, so it is still confirming; a `not-saved` the wallet declined is
 * cancelled; any other `not-saved` sent nothing that can still land. A
 * `not-batchable` save sent nothing either, and goes out one write at a time
 * instead, each its own act: its family keeps it apart from real failures.
 */
export function batchSaveActOutcome(outcome: {
  status: "saved" | "not-saved" | "unknown" | "not-batchable";
  declined?: true;
}): SendActOutcome | SendActEndingDetail {
  if (outcome.status === "saved") return "confirmed";
  if (outcome.status === "unknown") return "confirming";
  if (outcome.status === "not-batchable")
    return { outcome: "failed", parsedErrorFamily: "NotBatchable" };
  return outcome.declined ? "cancelled" : "failed";
}

/**
 * A send result on record without a receipt, or the hash of one, has not landed
 * yet. A result that says whether it is pending is believed; a bare hash, or a
 * result that says nothing, is checked against the sends noted as pending.
 */
function outcomeOfResult(result: unknown): Extract<SendActOutcome, "confirmed" | "confirming"> {
  const record =
    typeof result === "object" && result !== null ? (result as Record<string, unknown>) : {};
  if ("confirmation" in record)
    return record.confirmation === "pending" ? "confirming" : "confirmed";
  const hash = typeof result === "string" ? result : record.hash;
  return typeof hash === "string" && unconfirmedHashes.delete(hash.toLowerCase())
    ? "confirming"
    : "confirmed";
}

function contextProperties(context: SendActContext) {
  return {
    act: context.act,
    operation: context.operation,
    auth_mode: context.authMode ?? null,
    chain_id: context.chainId,
  };
}

function trackSendActStarted(context: SendActContext): void {
  track(SEND_ACT_STARTED, contextProperties(context), OPTIONS);
}

/**
 * One ending for an act of several copies: the copies' shared outcome, or
 * `partial` when they differ. Copies never tried are left out; an act that
 * tried none ends as failed.
 */
export function copiesEnding(
  outcomes: readonly (SendActCopyOutcome | null)[]
): SendActEndingDetail {
  const copies: Partial<Record<SendActCopyOutcome, number>> = {};
  for (const outcome of outcomes) if (outcome) copies[outcome] = (copies[outcome] ?? 0) + 1;
  const ended = Object.keys(copies) as SendActCopyOutcome[];
  return { outcome: ended.length === 1 ? ended[0]! : ended.length ? "partial" : "failed", copies };
}

function trackSendActEnded(
  context: SendActContext,
  ending: {
    outcome: SendActOutcome;
    durationMs: number;
    parsedErrorFamily?: string;
    copies?: SendActEndingDetail["copies"];
  }
): void {
  const copies = Object.fromEntries(
    Object.entries(ending.copies ?? {}).map(([outcome, count]) => [`copies_${outcome}`, count])
  );
  track(
    SEND_ACT_ENDED,
    {
      ...contextProperties(context),
      outcome: ending.outcome,
      duration_ms: Math.round(ending.durationMs),
      parsed_error_family: ending.parsedErrorFamily,
      ...copies,
    },
    OPTIONS
  );
}

/**
 * Runs one act between its start and its ending record, and hands back its
 * result or rethrows its error unchanged. A result with `confirmation:
 * "pending"` ends as `confirming`; `outcomeOf` names the ending of an act whose
 * result says more, such as one the job queue kept to send later, or one of
 * several copies (`copiesEnding`).
 */
export async function recordSendAct<T>(
  context: SendActContext,
  run: () => Promise<T>,
  outcomeOf: (result: T) => SendActOutcome | SendActEndingDetail = outcomeOfResult
): Promise<T> {
  const startedAt = Date.now();
  trackSendActStarted(context);
  let result: T;
  try {
    result = await run();
  } catch (error) {
    recordEnding(
      context,
      startedAt,
      () => sendActEnding(error),
      () => "failed"
    );
    throw error;
  }
  recordEnding(
    context,
    startedAt,
    () => outcomeOf(result),
    () => outcomeOfResult(result)
  );
  return result;
}

/**
 * The record never changes how the act ended: an ending that cannot be read is
 * logged and recorded by its fallback reading, and the act's own result or error stands.
 */
function recordEnding(
  context: SendActContext,
  startedAt: number,
  read: () => SendActOutcome | SendActEndingDetail,
  fallback: () => SendActOutcome
): void {
  let ending: SendActEndingDetail;
  try {
    const value = read();
    ending = typeof value === "string" ? { outcome: value } : value;
  } catch (error) {
    logger.warn("[sendActAnalytics] an act's ending could not be read", {
      act: context.act,
      error: error instanceof Error ? error.name : typeof error,
    });
    ending = { outcome: fallback() };
  }
  trackSendActEnded(context, { ...ending, durationMs: Date.now() - startedAt });
}

type SendActRun = (variables: never, ...rest: never[]) => Promise<unknown>;

/**
 * `run` with every call recorded as one act, for a mutation's `mutationFn`. The
 * context may be read from the call's own variables, to name which operation
 * ran. It hands back `run`'s own type, so `useMutation` still reads the
 * variables' type from `run`.
 */
export function recordedSendAct<F extends SendActRun>(
  context: SendActContext | ((variables: Parameters<F>[0]) => SendActContext),
  run: F,
  outcomeOf?: (result: Awaited<ReturnType<F>>) => SendActOutcome | SendActEndingDetail
): F {
  const call = run as unknown as (...args: Parameters<F>) => Promise<Awaited<ReturnType<F>>>;
  const recorded = (...args: Parameters<F>) => {
    let resolved: SendActContext;
    try {
      resolved = typeof context === "function" ? context(args[0]) : context;
    } catch (error) {
      // The act's own checks answer for variables the record cannot read.
      logger.warn("[sendActAnalytics] an act's context could not be read", {
        error: error instanceof Error ? error.name : typeof error,
      });
      return call(...args);
    }
    return recordSendAct(resolved, () => call(...args), outcomeOf);
  };
  return recorded as unknown as F;
}
