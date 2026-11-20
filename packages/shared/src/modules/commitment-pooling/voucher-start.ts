/**
 * A voucher booking's start (DL-193). Once the source accepts a booking, its start is two sends:
 * record the activation on the source, then send that decision to the escrow on Gnosis. The
 * source lets anyone send both, so the steward who accepts a booking sends them from their own
 * wallet straight after, and pays the network fee. The member's Start the Booking stays as a
 * fallback for a start that didn't go, offered once the steward has had fifteen minutes.
 *
 * @module modules/commitment-pooling/voucher-start
 */

import type { Hex } from "viem";
import { mayStillLand } from "../../utils/errors/tx-error-classifier";
import { logger } from "../app/logger";
import type { ContractCall, TxResult } from "../transactions/types";
import type { ServiceAccessSnapshot } from "./service-access-types";
import { voucherSetupAcceptedExactly } from "./service-access-voucher";
import type { ServiceVoucherSetup, VoucherSetupAction } from "./service-access-voucher-types";

/** How long after acceptance the member's Start the Booking waits for the steward's start. */
export const VOUCHER_START_FALLBACK_SECONDS = 15 * 60;

/**
 * Whether the member's fallback start is due: fifteen minutes after acceptance, in the source
 * chain's time. An acceptance whose time the index hasn't read yet has only just landed, while the
 * steward's start is likely going out, so the fallback waits: the source charges each send of a
 * start's decision its own fee, so two at once would pay twice. With the acceptance's time read but
 * the chain's clock unknown, the fallback shows, since it exists for the start that didn't go.
 */
export function voucherStartFallbackDue(
  acceptedAt: number | null | undefined,
  now: bigint | number | null | undefined
): boolean {
  if (acceptedAt === null || acceptedAt === undefined) return false;
  if (now === null || now === undefined) return true;
  return Number(now) - acceptedAt >= VOUCHER_START_FALLBACK_SECONDS;
}

/** The start's two sends, as the shared service actions name them. */
type VoucherStartAct =
  | Extract<VoucherSetupAction, { action: "finalizeVoucherActivation" }>
  | (Extract<VoucherSetupAction, { action: "dispatchVoucherSetupCommand" }> & {
      kind: "decision";
      expectedDecisionId: Hex;
    });

/**
 * Where a booking's start stands. `send`: the next of its two sends. `started`: both went, from
 * whoever sent them. `notAccepted`: the source hasn't accepted this setup. `unavailable`: nothing
 * can be sent now (a read that isn't the chain's, offline, paused, unquoted, or cancelled).
 */
export type VoucherStartState =
  | { kind: "send"; act: VoucherStartAct }
  | { kind: "started" }
  | { kind: "notAccepted" }
  | { kind: "unavailable" };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The next send of a booking's start, by the same rules the member's own Start the Booking
 * follows (`voucherSetupAvailableActions`, `selectVoucherSetupAction`), with no signer check:
 * the source lets anyone send these two.
 */
export function selectVoucherStart(
  s: ServiceAccessSnapshot,
  row: ServiceVoucherSetup
): VoucherStartState {
  const a = row.authorization;
  if (
    !["local-rehearsal", "onchain"].includes(s.evidence) ||
    s.capabilities.reasons.includes("offline") ||
    !row.complete ||
    a.sourceChainId !== s.key.sourceChainId ||
    !same(a.coreModule, s.key.coreModule) ||
    a.commitmentId !== s.key.commitmentId ||
    !same(a.buyer, s.key.buyer)
  )
    return { kind: "unavailable" };
  const bound = {
    sourceChainId: a.sourceChainId,
    sourceModule: a.sourceModule,
    setupId: row.setupId,
    expectedAuthorizationHash: row.authorizationHash,
  };
  const { decision, decisionId, decisionDispatched, acceptedReceiptHash } = row.source;
  if (decision === "none") {
    if (!voucherSetupAcceptedExactly(row) || !acceptedReceiptHash) return { kind: "notAccepted" };
    return {
      kind: "send",
      act: {
        ...bound,
        action: "finalizeVoucherActivation",
        expectedAcceptedReceiptHash: acceptedReceiptHash,
      },
    };
  }
  if (decision !== "activate") return { kind: "unavailable" };
  if (decisionDispatched) return { kind: "started" };
  // The source refuses an activation's send while paused, and only for its quoted fee.
  if (!decisionId || row.fees.decision === null || s.pause.sourceVoucher !== false)
    return { kind: "unavailable" };
  return {
    kind: "send",
    act: {
      ...bound,
      action: "dispatchVoucherSetupCommand",
      kind: "decision",
      expectedDecisionId: decisionId,
      reviewedNativeFee: row.fees.decision,
    },
  };
}

/** Which of the start's two sends an act is: record the activation, or send it to the escrow. */
export type VoucherStartStep = "record" | "send";

const voucherStartStep = (act: VoucherStartAct): VoucherStartStep =>
  act.action === "finalizeVoucherActivation" ? "record" : "send";

/** Each send of the start as it goes, for the steward's dialog. */
export type VoucherStartEvent =
  | { step: VoucherStartStep; status: "signing"; fee: bigint | null }
  | { step: VoucherStartStep; status: "confirming" }
  | { step: VoucherStartStep; status: "done"; hash: Hex }
  | { step: VoucherStartStep; status: "failed" };

/**
 * How the start ended. `started`: both sends landed, or someone else's did. `notSent`: the start
 * didn't go, or went only partway, and the member's fallback covers it. `unconfirmed`: a send went
 * out with no receipt yet; it may still land.
 */
export type VoucherStartOutcome = "started" | "notSent" | "unconfirmed";

export interface VoucherStartDependencies {
  /** Reads the booking again, proves the route, and builds the next send from the steward. */
  prepare(): Promise<{ state: VoucherStartState; call: ContractCall | null }>;
  send(call: ContractCall, step: VoucherStartStep): Promise<TxResult>;
  report(event: VoucherStartEvent): void;
  /** Waits before reading again; a read can trail a send that just landed. */
  wait?(ms: number): Promise<void>;
}

/** Reads after a send before the start is left to the fallback. */
const MAX_READS = 6;
const READ_AGAIN_MS = 2_000;

/**
 * Runs the start: each send only when a fresh read offers it, each its own approval. A read that
 * trails a send that just landed (the acceptance, or the start's own record) is read again, never
 * acted on: nothing is sent twice. A send that may still land is said to be confirming, never
 * failed. A failure after the acceptance never undoes it: the booking stays accepted and the
 * fallback covers the start.
 */
export async function runVoucherStart(
  deps: VoucherStartDependencies
): Promise<VoucherStartOutcome> {
  const wait =
    deps.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let landed: VoucherStartStep | null = null;
  for (let read = 0; read < MAX_READS; read += 1) {
    let next: Awaited<ReturnType<VoucherStartDependencies["prepare"]>>;
    try {
      next = await deps.prepare();
    } catch (error) {
      logger.warn("[voucher-start] the booking could not be read to start it", { error });
      return "notSent";
    }
    const { state, call } = next;
    if (state.kind === "started") return "started";
    // The acceptance has its receipt; a read that doesn't show it yet trails the chain.
    const trailing =
      state.kind === "notAccepted" ||
      (state.kind === "send" && voucherStartStep(state.act) === landed);
    if (trailing) {
      await wait(READ_AGAIN_MS);
      continue;
    }
    if (state.kind !== "send" || !call) return "notSent";
    const step = voucherStartStep(state.act);
    deps.report({
      step,
      status: "signing",
      fee: state.act.action === "dispatchVoucherSetupCommand" ? state.act.reviewedNativeFee : null,
    });
    let result: TxResult;
    try {
      result = await deps.send(call, step);
    } catch (error) {
      // Past its limit, or stopped while the wallet may still hold it (PRD-1551): not a failure.
      if (mayStillLand(error)) {
        deps.report({ step, status: "confirming" });
        return "unconfirmed";
      }
      logger.warn("[voucher-start] a send of the start didn't go through", { error, step });
      deps.report({ step, status: "failed" });
      return "notSent";
    }
    if (result.confirmation === "pending") {
      deps.report({ step, status: "confirming" });
      return "unconfirmed";
    }
    deps.report({ step, status: "done", hash: result.hash });
    if (step === "send") return "started";
    landed = step;
  }
  return "notSent";
}
