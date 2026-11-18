/**
 * Editing who confirms a promise
 *
 * Edit Confirmers gives every copy nobody has taken the same named confirmer
 * group and threshold, so a steward can name an account that replaced a lost
 * one, add a reviewer, or go back to the ordinary rule. The contract lets the
 * pool steward rewrite the rule only while a commitment is offered or
 * requested (`TermsLib.setConfirmerRule`); a taken copy keeps the confirmers
 * it was taken up under, and the group stays one row because its grouping
 * leaves the confirmer rule out (`display-groups`).
 *
 * Each copy keeps its own "let the Green Goods team confirm" setting: the call
 * writes it too, so it is read from the copy, never chosen here. Like Edit
 * Reward this is a direct act, nothing is queued, and writing the rule a copy
 * already has changes nothing, so trying again is always safe. No passkey
 * rail is listed for these edits yet, so a passkey is asked once per copy; a
 * wallet that runs several calls as one transaction is asked once.
 *
 * @module modules/commitment-pooling/confirmer-edit
 */

import type { Address } from "../../types/domain";
import { CommitmentPoolingModuleABI } from "../../utils/blockchain/contracts";
import type { ContractCall, TransactionSender } from "../transactions/types";
import { type CopyEditProgress, sendCopyEdits } from "./copy-edit-send";
import { type CreationSendMode, copiesSendMode } from "./creation-send";

/** The contract's cap on named confirmers (`CommonLib.MAX_CONFIRMERS`). */
const MAX_NAMED_CONFIRMERS = 40;

/** Copies changed per wallet approval, as for Edit Reward. */
const CONFIRMER_EDIT_BUNDLE_SIZE = 50;

/** A named group and how many of it must confirm; nobody named is the ordinary rule. */
export interface ConfirmerRule {
  confirmers: readonly Address[];
  threshold: number;
}

/** One copy to change, with the team fallback it already has. */
export interface ConfirmerEditCopy {
  commitmentId: bigint;
  protocolFallbackEnabled: boolean;
}

export type ConfirmerEditProgress = CopyEditProgress;

/** Why a rule can't be written, as the composer's message ids; null when it can. */
export type ConfirmerRuleError =
  | "hub.garden.pool.seed.error.confirmersTooMany"
  | "hub.garden.pool.seed.error.thresholdAtLeastOne"
  | "hub.garden.pool.seed.error.thresholdAboveGroup";

/**
 * The contract's own checks on a rule (`CreationChecksLib.validateConfirmerRule`),
 * plus the threshold it could never reach: more confirmations than names.
 */
export function confirmerRuleError(rule: ConfirmerRule): ConfirmerRuleError | null {
  const count = rule.confirmers.length;
  if (count > MAX_NAMED_CONFIRMERS) return "hub.garden.pool.seed.error.confirmersTooMany";
  if (count === 0) return null;
  if (!Number.isInteger(rule.threshold) || rule.threshold < 1) {
    return "hub.garden.pool.seed.error.thresholdAtLeastOne";
  }
  return rule.threshold > count ? "hub.garden.pool.seed.error.thresholdAboveGroup" : null;
}

/** Whether two rules name the same people with the same threshold, in any order. */
export function sameConfirmerRule(left: ConfirmerRule, right: ConfirmerRule): boolean {
  if (left.confirmers.length !== right.confirmers.length) return false;
  const named = new Set(left.confirmers.map((address) => address.toLowerCase()));
  if (!right.confirmers.every((address) => named.has(address.toLowerCase()))) return false;
  // With nobody named the contract keeps one confirmation, whatever was asked.
  return left.confirmers.length === 0 || left.threshold === right.threshold;
}

/** How Edit Confirmers asks: once per copy for a passkey, once per group for a batching wallet. */
export function confirmerEditSendMode(
  sender: TransactionSender | null,
  chainId: number
): Promise<CreationSendMode> {
  return copiesSendMode(sender, chainId, "confirmer-edits", null);
}

export async function sendConfirmerEdit(input: {
  sender: TransactionSender | null;
  chainId: number;
  moduleAddress: Address;
  /** The copies nobody has taken; the contract refuses any other. */
  copies: readonly ConfirmerEditCopy[];
  rule: ConfirmerRule;
  /** Told each time a copy moves. Report-only: a throw here never reaches a send. */
  onCopy?: (progress: ConfirmerEditProgress) => void;
}): Promise<ConfirmerEditProgress[]> {
  const { sender, chainId, moduleAddress, rule } = input;
  const fallbackOf = new Map(
    input.copies.map((copy) => [copy.commitmentId, copy.protocolFallbackEnabled])
  );
  // The contract stores one confirmation for the ordinary rule whatever is sent.
  const threshold = rule.confirmers.length === 0 ? 1 : rule.threshold;
  return sendCopyEdits({
    sender,
    mode: await confirmerEditSendMode(sender, chainId),
    commitmentIds: input.copies.map((copy) => copy.commitmentId),
    callFor: (commitmentId: bigint): ContractCall => ({
      address: moduleAddress,
      abi: CommitmentPoolingModuleABI,
      functionName: "setConfirmerRule",
      args: [commitmentId, [...rule.confirmers], threshold, fallbackOf.get(commitmentId) ?? false],
      chainId,
    }),
    bundleSize: CONFIRMER_EDIT_BUNDLE_SIZE,
    batchBudget: null,
    onCopy: input.onCopy,
  });
}
