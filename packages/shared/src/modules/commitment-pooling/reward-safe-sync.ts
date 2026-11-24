/**
 * Keeping a garden reward Safe's signers to its stewards
 *
 * Before a steward approves a payment, they bring the Safe's signers up to date from their own
 * account: the Hats Signer Gate removes each owner who no longer wears the garden's steward hat,
 * and the steward claims a seat if they have none. Otherwise a stale owner's approval, or a
 * threshold a stale owner raised, could stop the payment.
 *
 * @module modules/commitment-pooling/reward-safe-sync
 */

import type { Abi } from "viem";
import { logger } from "../app/logger";
import type { Address } from "../../types/domain";
import { mayStillLand } from "../../utils/errors/tx-error-classifier";
import type { ContractCall, TransactionSender } from "../transactions/types";
import { missOfSend } from "./creation-send";
import { unsponsored } from "./reward-pay-send";
import { REWARD_SAFE_GATE_ABI, type RewardPayChain } from "./reward-safe-chain";
import type { SeedCopyMiss } from "./seed-sets";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export type RewardSafeSyncOutcome =
  /** The signers are current, or every change went out (`confirmed` says whether all landed). */
  | { status: "synced"; confirmed: boolean }
  | { status: "refused-before-asking"; refusal: "not-a-steward" | "unreadable" }
  /**
   * The gas sponsor turned the passkey's next change down before it went out. `partly` says an
   * earlier change already went out.
   */
  | { status: "unsponsored"; partly: boolean }
  /** A change didn't go through. `partly` says an earlier change already went out. */
  | { status: "not-synced"; miss: SeedCopyMiss; partly: boolean };

/**
 * Brings a garden Safe's signers up to date from a steward's own account before they approve: the
 * gate removes each owner who no longer wears the steward hat, then the steward claims a seat if
 * they have none. One call, and one signature, per change, so the Hub can say how many up front.
 * Asks for nothing when the signers are already current.
 */
export async function sendRewardSafeSync(input: {
  sender: TransactionSender;
  chain: RewardPayChain;
  chainId: number;
  safe: Address;
  gate: Address;
  signerHat: bigint;
  account: Address;
}): Promise<RewardSafeSyncOutcome> {
  const { sender, chain, chainId, safe, gate, signerHat, account } = input;
  let calls: ContractCall[];
  try {
    const [state, wears] = await Promise.all([
      chain.safeState(safe),
      chain.wearsHat(gate, account, signerHat),
    ]);
    if (!wears) return { status: "refused-before-asking", refusal: "not-a-steward" };
    const gated = await chain.gateState(gate, state.owners);
    if (!same(gated.safe, safe)) return { status: "refused-before-asking", refusal: "unreadable" };
    const gateCall = (functionName: "removeSigner" | "claimSigner", args: readonly unknown[]) =>
      ({
        address: gate,
        account,
        abi: REWARD_SAFE_GATE_ABI as unknown as Abi,
        functionName,
        args: [...args],
        chainId,
      }) satisfies ContractCall;
    calls = [
      ...state.owners
        .filter((owner, index) => gated.valid[index] !== true && !same(owner, gate))
        .map((owner) => gateCall("removeSigner", [owner])),
      ...(state.owners.some((owner) => same(owner, account))
        ? []
        : [gateCall("claimSigner", [signerHat])]),
    ];
  } catch (error) {
    logger.warn("Reward Safe signer reads failed before asking", { error, chainId });
    return { status: "refused-before-asking", refusal: "unreadable" };
  }
  if (calls.length === 0) return { status: "synced", confirmed: true };
  // `current` says whether the change being sent went out; `done` counts the changes that did.
  let current = false;
  let done = 0;
  const options = { onBeforeBroadcast: async () => void (current = true) };
  try {
    let confirmed = true;
    for (const call of calls) {
      current = false;
      const sent = await sender.sendContractCall(call, options);
      done += 1;
      if (sent.confirmation === "pending") confirmed = false;
    }
    return { status: "synced", confirmed };
  } catch (error) {
    const partly = done > 0;
    // The change may still land, but any after it never went out.
    if (current && mayStillLand(error)) {
      return done === calls.length - 1
        ? { status: "synced", confirmed: false }
        : { status: "not-synced", miss: "failed", partly: true };
    }
    if (unsponsored(sender, error, current)) return { status: "unsponsored", partly };
    return { status: "not-synced", miss: missOfSend(error, !current && !partly), partly };
  }
}
