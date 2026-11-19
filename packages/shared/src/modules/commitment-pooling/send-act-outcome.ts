/**
 * How a pool act ended, for its send record (PRD-1553): an act of several
 * copies, a setup run of ordered pool writes, an issuer's reviewed send, or a
 * voucher award.
 *
 * @module modules/commitment-pooling/send-act-outcome
 */

import {
  copiesEnding,
  recordedSendAct,
  type SendActCopyOutcome,
  type SendActEndingDetail,
  type SendActOutcome,
  sendActEnding,
} from "../app/sendActAnalytics";
import type { TransactionSender } from "../transactions/types";
import type { VoucherAwardRecord } from "../../public-contracts/voucher-awards";
import type { CopyEditStatus } from "./copy-edit-send";
import type { PoolSetupOutcome, PoolSetupStep } from "./pool-setup";
import type { ServiceIssuerOutcome } from "./service-issuer-types";
import type { SeedCopyMiss, SeedCopyStatus } from "./seed-sets";

interface CopyEnding {
  status: SeedCopyStatus | CopyEditStatus;
  miss?: SeedCopyMiss;
  /** A creation copy's job; `null` once a copy failed before the queue took it. */
  jobId?: string | null;
}

/**
 * One copy's outcome. A copy still waiting, preparing or at the wallet was
 * never tried. A `failed` miss may have reached the chain (`SeedCopyMiss`), so
 * it is still confirming, never failed, unless the copy never had a job: the
 * queue refused to take it, so nothing reached a sender.
 */
export function copyActOutcome(copy: CopyEnding): SendActCopyOutcome | null {
  switch (copy.status) {
    case "created":
    case "changed":
      return "confirmed";
    case "later":
      return "queued";
    case "confirming":
      return "confirming";
    case "not-sent":
    case "not-changed":
      if (copy.miss === "declined") return "cancelled";
      if (copy.miss === "failed") return copy.jobId === null ? "failed" : "confirming";
      return "failed";
    default:
      return null;
  }
}

/** The ending of a pool act that sent `copies`. */
export function copiesActEnding(copies: readonly CopyEnding[]): SendActEndingDetail {
  return copiesEnding(copies.map(copyActOutcome));
}

/**
 * How a setup run ended. A run that stopped after a send went out may still
 * land: a seed whose receipt was lost, or a step its receipt confirmed that the
 * chain does not show yet. A send that failed reads its error. Every other stop
 * came before anything was sent.
 */
export function poolSetupActEnding(outcome: PoolSetupOutcome): SendActEndingDetail {
  if (outcome.status === "complete") return { outcome: "confirmed" };
  if (outcome.failure === "seed-unconfirmed" || outcome.failure === "not-confirmed")
    return { outcome: "confirming" };
  if (outcome.failure === "send-failed") return sendActEnding(outcome.error);
  return { outcome: "failed" };
}

/** A setup run recorded as one act, its operation the writes it was asked to run. */
export function recordedSetupRun(
  sender: Pick<TransactionSender, "authMode"> | null,
  chainId: number,
  run: (steps: PoolSetupStep[]) => Promise<PoolSetupOutcome>
): (steps: PoolSetupStep[]) => Promise<PoolSetupOutcome> {
  const context = (steps: PoolSetupStep[]) => ({
    act: "pool_setup" as const,
    operation: steps.map((step) => step.action).join(","),
    authMode: sender?.authMode,
    chainId,
  });
  return recordedSendAct(context, run, poolSetupActEnding);
}

/** An issuer's reviewed send: a pending one went out and may still land. */
export function issuerActOutcome(outcome: ServiceIssuerOutcome): SendActOutcome {
  if (outcome.status === "confirmed") return "confirmed";
  return outcome.status === "pending" ? "confirming" : "failed";
}

/**
 * A voucher award's send. One submitted, waiting on the reserve's other signers,
 * or left to reconcile went out and may still land.
 */
export function voucherAwardActOutcome(result: {
  record: Pick<VoucherAwardRecord, "state">;
}): SendActOutcome {
  if (result.record.state === "confirmed") return "confirmed";
  return result.record.state === "failed" ? "failed" : "confirming";
}
