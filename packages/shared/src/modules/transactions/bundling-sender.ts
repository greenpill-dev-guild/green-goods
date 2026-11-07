/**
 * Several queued jobs, one wallet approval
 *
 * A steward creating ten copies of a promise should be asked once, not ten
 * times. The wallet can take several calls as one atomic request
 * (`sendAtomicBatch`, EIP-5792), but every queued job still has to run through
 * the queue on its own: its claim, its preparation, its recovery read and its
 * failure record are what keep a retry from ever becoming a second commitment.
 *
 * So each job gets a sender of its own from here, and its one call is held
 * rather than sent. Once every job has either handed over its call or finished
 * without one (it already existed, or it has to wait), the calls go to the
 * wallet together, and each job hears the same answer. A job that finished
 * early never holds the others back, and a job that sent never waits on one
 * that didn't.
 *
 * The request is all or nothing, so every job in it ends the same way: sent
 * with one transaction hash, or refused with one error. A passkey's request
 * also needs the reviewed ceilings it is checked against before the prompt
 * (`batchBudget`).
 *
 * The calls go in the order the participants were named, so a later one can
 * rely on an earlier one: Add and Send's send reverts unless its proof runs
 * first. Such a pair asks for `everyOrNone`, and then the request goes only
 * with every call in it. Each job records its intent where the sender says the
 * request can go out: after a passkey signs, or just before a wallet asks.
 *
 * @module modules/transactions/bundling-sender
 */

import { classifyTxError } from "../../utils/errors/tx-error-classifier";
import { type BatchBudget, BatchNotSubmittedError, BundleIncompleteError } from "./batch-types";
import type { ContractCall, TransactionSender, TransactionSendOptions, TxResult } from "./types";

/** How the one request ended, for whoever sends the next thing. */
export type BundleOutcome =
  | { status: "sent"; hash: `0x${string}` }
  /** The person declined in the wallet: nothing reached the chain. */
  | { status: "declined"; error: unknown }
  /**
   * Refused before or on the chain (reverted, unaffordable, or stopped by the
   * sender's own checks before it went out): nothing was recorded.
   */
  | { status: "refused"; error: unknown }
  /** Anything else. The answer may have been lost, so the chain must be read before sending again. */
  | { status: "failed"; error: unknown }
  /** Every job finished without a call, so nothing was asked of the wallet. */
  | { status: "empty" };

export interface BundlingSender {
  /** The sender one job sends through. Its call is held until the request goes out. */
  senderFor(participant: string): TransactionSender;
  /** The job finished. A job that never sent is counted here so the request isn't held for it. */
  finished(participant: string): void;
  /** Whether this job's call was in the request. */
  sentBy(participant: string): boolean;
  /** Settles once the request has gone out, or once it's clear none will. */
  outcome: Promise<BundleOutcome>;
}

interface HeldCall {
  call: ContractCall;
  options: TransactionSendOptions;
  resolve: (result: TxResult) => void;
  reject: (error: unknown) => void;
}

/** A sender that proves the request never went out has answered, whatever its error says. */
function outcomeOfError(error: unknown, neverSent: boolean): BundleOutcome {
  const { kind } = classifyTxError(error);
  if (kind === "cancelled") return { status: "declined", error };
  if (kind === "reverted" || neverSent) return { status: "refused", error };
  return { status: "failed", error };
}

export function createBundlingSender(
  base: TransactionSender,
  participants: readonly string[],
  hooks: {
    /** The calls are about to go to the wallet. */
    onAsking?: () => void;
    /** The wallet accepted the request; its receipt is still to come. */
    onAccepted?: () => void;
    /** The ceilings the one request is checked against; a passkey sends none without them. */
    batchBudget?: BatchBudget;
    /** Send only with every participant's call: none of them may go without the others. */
    everyOrNone?: boolean;
  } = {}
): BundlingSender {
  if (!base.sendAtomicBatch) throw new Error("This sender cannot send an atomic batch");
  const sendAtomicBatch = base.sendAtomicBatch.bind(base);
  const expected = new Set(participants);
  const held = new Map<string, HeldCall>();
  const finished = new Set<string>();
  let flushed = false;
  let settle: (outcome: BundleOutcome) => void = () => undefined;
  const outcome = new Promise<BundleOutcome>((resolve) => {
    settle = resolve;
  });

  const flush = async () => {
    const calls = participants.flatMap((participant) => {
      const call = held.get(participant);
      return call ? [call] : [];
    });
    if (calls.length === 0) {
      settle({ status: "empty" });
      return;
    }
    if (hooks.everyOrNone && calls.length < participants.length) {
      // One finished without a call (it had landed, or must wait), and the rest
      // can't go without it. Nothing was asked of the wallet.
      const error = new BundleIncompleteError();
      settle({ status: "refused", error });
      for (const { reject } of calls) reject(error);
      return;
    }
    const checkpointAll = async (
      notify: (options: TransactionSendOptions) => Promise<void> | undefined
    ) => {
      // An accepted send belongs to every job even if one durable checkpoint fails.
      const results = await Promise.allSettled(calls.map(async ({ options }) => notify(options)));
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
    };
    let neverSent = false;
    try {
      // Each job checks it still owns its send, as a single send would, before
      // anything can reach the wallet. One that doesn't stops the whole request.
      for (const { options } of calls) await options.assertOwnership?.();
      hooks.onAsking?.();
      const result = await sendAtomicBatch(
        calls.map(({ call }) => call),
        {
          batchBudget: hooks.batchBudget,
          onNeverSent: () => {
            neverSent = true;
          },
          assertOwnership: async () => {
            for (const { options } of calls) await options.assertOwnership?.();
          },
          // A job whose intent can't be recorded stops the request before it goes.
          onBeforeBroadcast: async (reference) => {
            for (const { options } of calls) await options.onBeforeBroadcast?.(reference);
          },
          onBatchReference: async (reference) => {
            await checkpointAll((options) => options.onBatchReference?.(reference));
          },
          onBroadcastReference: async (reference) => {
            await checkpointAll((options) => options.onBroadcastReference?.(reference));
          },
          onAccepted: async () => {
            hooks.onAccepted?.();
          },
        }
      );
      await checkpointAll((options) => options.onBroadcast?.(result.hash));
      settle({ status: "sent", hash: result.hash });
      for (const { resolve } of calls) resolve(result);
    } catch (error) {
      settle(outcomeOfError(error, neverSent));
      // Proven unsent, so each job's own send record reads it so, intent or not.
      const answer =
        neverSent && !(error instanceof BatchNotSubmittedError)
          ? new BatchNotSubmittedError(error)
          : error;
      for (const { reject } of calls) reject(answer);
    }
  };

  const flushWhenReady = () => {
    if (flushed) return;
    for (const participant of expected) {
      if (!held.has(participant) && !finished.has(participant)) return;
    }
    flushed = true;
    void flush();
  };

  return {
    outcome,
    sentBy: (participant) => held.has(participant),
    finished(participant) {
      finished.add(participant);
      flushWhenReady();
    },
    senderFor(participant) {
      if (!expected.has(participant)) throw new Error(`Unknown bundle participant: ${participant}`);
      return {
        authMode: base.authMode,
        supportsBatching: base.supportsBatching,
        supportsSponsorship: base.supportsSponsorship,
        bundledWith: participants,
        ...(base.assertOwnership ? { assertOwnership: base.assertOwnership.bind(base) } : {}),
        ...(base.reconcileBatch ? { reconcileBatch: base.reconcileBatch.bind(base) } : {}),
        ...(base.reconcileBroadcast
          ? { reconcileBroadcast: base.reconcileBroadcast.bind(base) }
          : {}),
        sendContractCall(call, options = {}) {
          return new Promise<TxResult>((resolve, reject) => {
            if (flushed || held.has(participant)) {
              reject(new Error("This job's call can no longer join the bundle"));
              return;
            }
            held.set(participant, { call, options, resolve, reject });
            flushWhenReady();
          });
        },
      };
    },
  };
}
