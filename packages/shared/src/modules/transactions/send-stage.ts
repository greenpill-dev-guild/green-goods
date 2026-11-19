/**
 * Where a send stands while someone watches it, and the one set of words the App, the Hub and
 * the bot say for it (PRD-1552). Each surface keeps its own words for what comes before a send
 * (checking, uploading) and after it (recorded, approved); these stages read the same
 * everywhere:
 *
 * - `wallet`: the person's wallet is asked to approve the send. Only a wallet sign-in has this
 *   stage: a passkey approves in the app before anything goes out, and an embedded wallet asks
 *   nobody. Past 20 seconds (`WALLET_NUDGE_MS`) it says to open the wallet and offers Cancel,
 *   and once the person stops waiting it says the wallet may still hold the request (PRD-1551).
 * - `confirming`: the network has the send and its receipt has not come.
 * - `still-confirming`: the receipt wait passed its limit. The send went out and may still
 *   land, so it is never called failed, and the person can leave.
 * - `safe-signers`: the wallet answered with a Safe proposal. No receipt follows it: it lands
 *   once enough of the Safe's owners sign it and someone runs it (PRD-1551).
 *
 * The words are message descriptors whose text is in the Shared catalogs (`app.sendStage.*`),
 * so a screen formats them with its own `formatMessage` and the bot reads the same entries.
 *
 * A send reports the first two as they happen (`withSendStageReports`). Still confirming is a
 * send's record, not a moment: its broadcast is on record and its receipt has not been seen.
 *
 * @module modules/transactions/send-stage
 */

import type { Hex } from "viem";
import type { TransactionSender, TransactionSendOptions } from "./types";

export type SendStage = "wallet" | "confirming" | "still-confirming" | "safe-signers";

/** How long a send waits on the wallet before it says to open the wallet and offers Cancel. */
export const WALLET_NUDGE_MS = 20_000;

/** A stage as a send reports it: once the network has the send, with its hash. */
export type SendStageReport =
  | { stage: "wallet" }
  | { stage: "confirming"; txHash: Hex }
  | { stage: "still-confirming" };

/** The stages a send reports while it runs. */
export type LiveSendStageReport = Exclude<SendStageReport, { stage: "still-confirming" }>;

/**
 * The send options with its stages reported as they happen. Only a wallet asks the person, just
 * before the send can reach the network, so only a wallet sender reports the wallet stage: a
 * passkey's `onBeforeBroadcast` comes after its prompt was approved, and an embedded wallet asks
 * nobody. Every sender reports confirming once the network has the send. The send's own callbacks
 * run first and keep their say, so a checkpoint that fails to save still stops the send; `report`
 * runs after and must not throw.
 */
export function withSendStageReports(
  options: TransactionSendOptions,
  authMode: TransactionSender["authMode"],
  report: (stage: LiveSendStageReport) => void
): TransactionSendOptions {
  return {
    ...options,
    onBeforeBroadcast: async (reference) => {
      await options.onBeforeBroadcast?.(reference);
      if (authMode === "wallet") report({ stage: "wallet" });
    },
    onBroadcast: async (hash) => {
      await options.onBroadcast?.(hash);
      report({ stage: "confirming", txHash: hash });
    },
  };
}

/** The sender, with every single send it makes reporting its stages (`withSendStageReports`). */
export function reportingSendStages(
  sender: TransactionSender,
  report: (stage: LiveSendStageReport) => void
): TransactionSender {
  const reporting = Object.create(sender) as TransactionSender;
  reporting.sendContractCall = (call, options = {}) =>
    sender.sendContractCall(call, withSendStageReports(options, sender.authMode, report));
  return reporting;
}

/** A catalog entry: its id, and the English text a screen falls back to. */
export interface SendStageMessage {
  id: string;
  defaultMessage: string;
}

interface SendStageWords {
  label: SendStageMessage;
  detail?: SendStageMessage;
  stopped?: SendStageMessage;
}

/** A stage's words, with the entries it always has made required. */
type StageWords<Has extends "detail" | "stopped" = never> = SendStageWords &
  Required<Pick<SendStageWords, Has>>;

/**
 * Each stage's words. `label` fits a pill, a button or a toast title. `detail` is the sentence
 * that follows where there is room: still confirming says the send went out and the person can
 * leave, and the wallet's says to open it once the wait passes `WALLET_NUDGE_MS`. `stopped` is
 * what the wallet stage says after the person stops waiting for it.
 */
export const SEND_STAGE_WORDS: {
  wallet: StageWords<"detail" | "stopped">;
  confirming: StageWords;
  "still-confirming": StageWords<"detail">;
  "safe-signers": StageWords<"detail">;
} = {
  wallet: {
    label: { id: "app.sendStage.wallet", defaultMessage: "Confirm in your wallet" },
    detail: {
      id: "app.sendStage.wallet.detail",
      defaultMessage: "Still waiting for your wallet. Open it to approve or reject the request.",
    },
    stopped: {
      id: "app.sendStage.wallet.stopped",
      defaultMessage: "Stopped waiting. If your wallet still shows the request, reject it there.",
    },
  },
  confirming: {
    label: { id: "app.sendStage.confirming", defaultMessage: "Confirming…" },
  },
  "still-confirming": {
    label: { id: "app.sendStage.stillConfirming", defaultMessage: "Still confirming…" },
    detail: {
      id: "app.sendStage.stillConfirming.detail",
      defaultMessage:
        "Sent. Confirming is taking longer than usual. You can leave, and you don't need to send it again.",
    },
  },
  "safe-signers": {
    label: { id: "app.sendStage.safeSigners", defaultMessage: "Waiting for the Safe's signers" },
    detail: {
      id: "app.sendStage.safeSigners.detail",
      defaultMessage:
        "Your Safe has the proposal. It goes through once enough of the Safe's owners sign it.",
    },
  },
};
