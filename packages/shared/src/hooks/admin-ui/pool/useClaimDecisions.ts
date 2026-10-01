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
import { claimActKey, type TxActPhase } from "../../../modules/transactions/act-phase";
import { useClaimDecisionStore } from "../../../stores/useClaimDecisionStore";
import type { Address } from "../../../types/domain";
import type { ActSendCallbacks } from "../../blockchain/useTxActPhase";

export interface ClaimDecisionActs {
  /** The approval running or last settled, keyed to its ask. */
  phase: TxActPhase;
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
  const decisions = useClaimDecisionStore((state) => state.decisions);
  const step = useClaimDecisionStore((state) => state.step);
  const decide = useClaimDecisionStore((state) => state.decide);

  const approve = useCallback(
    async <T>(
      commitmentId: bigint,
      claimant: Address,
      act: (send: ActSendCallbacks) => Promise<T>,
      requestedAt?: number
    ): Promise<T> => {
      const key = claimActKey(commitmentId, claimant);
      step({ type: "start", key });
      try {
        const result = await act({
          onBroadcast: async (hash) => step({ type: "broadcast", key, hash }),
        });
        decide(key, {
          kind: "approved",
          commitmentId: commitmentId.toString(),
          at: Date.now(),
          requestedAt,
        });
        return result;
      } catch (error) {
        step({ type: "failed", key });
        throw error;
      }
    },
    [step, decide]
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

  return { phase, decisions, approve, decline };
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
