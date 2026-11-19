/**
 * useClaimDecisions Hook
 *
 * Approving and declining an ask, for the two places a steward does it: the
 * Pool tab's Waiting for approval card and the commitment inspector. Both go
 * through one line and one set of decisions (`useClaimDecisionStore`), so an
 * approval started in the inspector shows its progress on the card's row, and
 * both keep the outcome for the visit. Each act's result or error passes
 * straight through, so the mutation's own error handling is unchanged.
 *
 * @module hooks/admin-ui/pool/useClaimDecisions
 */

import { useCallback, useEffect } from "react";
import type { ClaimDecisions } from "../../../modules/commitment-pooling/waiting-for-approval";
import {
  actPhaseFor,
  claimActKey,
  IDLE_ACT_PHASE,
  type TxActPhase,
} from "../../../modules/transactions/act-phase";
import { useClaimDecisionStore } from "../../../stores/useClaimDecisionStore";
import type { Address } from "../../../types/domain";
import { type ActSendCallbacks, followAct } from "../../blockchain/useTxActPhase";
import { useOptionalAuthContext } from "../../../providers/Auth";
import { useTimeout } from "../../utils/useTimeout";

export interface ClaimDecisionActs {
  /** The approval running or last settled, keyed to its ask. */
  phase: TxActPhase;
  /**
   * One ask's approval: the running or last one on the line, or else the ending it was held in
   * (still confirming, waiting on a Safe's signers, stopped), which another approval never clears.
   */
  phaseOf: (key: string) => TxActPhase;
  decisions: ClaimDecisions;
  /** `requestedAt` names the ask decided, when the caller has it (`ClaimDecision`). */
  approve: <T>(
    commitmentId: bigint,
    claimant: Address,
    act: (send: ActSendCallbacks) => Promise<T>,
    requestedAt?: number
  ) => Promise<T>;
  decline: <T>(
    commitmentId: bigint,
    claimant: Address,
    act: () => Promise<T>,
    requestedAt?: number
  ) => Promise<T>;
}

export function useClaimDecisions(): ClaimDecisionActs {
  const phase = useClaimDecisionStore((state) => state.phase);
  const held = useClaimDecisionStore((state) => state.held);
  const decisions = useClaimDecisionStore((state) => state.decisions);
  const step = useClaimDecisionStore((state) => state.step);
  const decide = useClaimDecisionStore((state) => state.decide);
  const { set: setNudge, clear: clearNudge } = useTimeout();
  const waitsOnWallet = useOptionalAuthContext()?.authMode === "wallet";

  // The line follows the approval as any single-signature act's does. A Safe's proposal is not
  // an approval yet, so only an approval that landed is kept as a decision.
  const approve = useCallback(
    <T>(
      commitmentId: bigint,
      claimant: Address,
      act: (send: ActSendCallbacks) => Promise<T>,
      requestedAt?: number
    ): Promise<T> => {
      const key = claimActKey(commitmentId, claimant);
      return followAct(key, act, {
        step,
        waitsOnWallet,
        setNudge,
        clearNudge,
        landed: () =>
          decide(key, {
            kind: "approved",
            commitmentId: commitmentId.toString(),
            at: Date.now(),
            requestedAt,
          }),
      });
    },
    [step, decide, waitsOnWallet, setNudge, clearNudge]
  );

  const decline = useCallback(
    async <T>(
      commitmentId: bigint,
      claimant: Address,
      act: () => Promise<T>,
      requestedAt?: number
    ): Promise<T> => {
      const result = await act();
      decide(claimActKey(commitmentId, claimant), {
        kind: "declined",
        commitmentId: commitmentId.toString(),
        at: Date.now(),
        requestedAt,
      });
      return result;
    },
    [decide]
  );

  const phaseOf = useCallback(
    (key: string) => {
      const onLine = actPhaseFor(phase, key);
      return onLine.status !== "idle" ? onLine : (held[key] ?? IDLE_ACT_PHASE);
    },
    [phase, held]
  );

  return { phase, phaseOf, decisions, approve, decline };
}

/**
 * Begins a visit to a pool's tab: decisions from an earlier visit, or another
 * pool, are cleared. The Pool tab calls it; the inspector, and a flow opened
 * over the tab, only join the visit (`begins: false`), so opening one never
 * clears the outcomes the tab is showing.
 */
export function useClaimDecisionVisit(chainId: number, garden: Address, begins = true): void {
  const beginVisit = useClaimDecisionStore((state) => state.beginVisit);
  useEffect(() => {
    if (begins) beginVisit(`${chainId}:${garden.toLowerCase()}`);
  }, [beginVisit, begins, chainId, garden]);
}
