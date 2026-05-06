import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConvictionAllocations } from "../../types/conviction";
import type { Address } from "../../types/domain";
import { allocationsToPercentMap, percentMapToSignedDeltas } from "../../utils/conviction";
import { useTimeout } from "../utils/useTimeout";
import { useAllocateHypercertSupport } from "./useAllocateHypercertSupport";
import { useMemberVotingPower } from "./useMemberVotingPower";

interface UseConvictionWeightAllocatorOptions {
  /** Debounce window before the on-chain save fires. Default 400ms. */
  debounceMs?: number;
  enabled?: boolean;
}

interface UseConvictionWeightAllocatorResult {
  allocations: ConvictionAllocations;
  setAllocations: (next: ConvictionAllocations) => void;
  /**
   * Force-flush the pending debounced save (e.g., when the user closes a
   * sheet before the debounce expires). No-op when there are no pending
   * changes.
   */
  flush: () => void;
  isDirty: boolean;
  isSaving: boolean;
  /** True while the underlying useMemberVotingPower query is loading. */
  isLoading: boolean;
}

/**
 * Optimistic-state container for the WeightAllocator. Mirrors the on-chain
 * allocations (via useMemberVotingPower) into a local percent map; debounces
 * server saves; computes signed deltas via percentMapToSignedDeltas before
 * dispatching the contract tx through useAllocateHypercertSupport.
 *
 * Audit finding #4 from the Tier-5 audit-then-ship pass.
 *
 * Per CLAUDE.md react-patterns rule 1, debounce is implemented via
 * useTimeout (not raw setTimeout). Per design_handoff README § 9, the save
 * cadence is 300–500ms — defaults to 400ms here.
 */
export function useConvictionWeightAllocator(
  poolAddress?: Address,
  voterAddress?: Address,
  options: UseConvictionWeightAllocatorOptions = {}
): UseConvictionWeightAllocatorResult {
  const debounceMs = options.debounceMs ?? 400;
  const enabled = options.enabled ?? true;

  const { power, isLoading } = useMemberVotingPower(poolAddress, voterAddress, { enabled });
  const allocateMutation = useAllocateHypercertSupport();

  const serverAllocations = useMemo<ConvictionAllocations>(
    () => allocationsToPercentMap(power.allocations, power.pointsBudget),
    [power.allocations, power.pointsBudget]
  );

  const [localAllocations, setLocalAllocations] =
    useState<ConvictionAllocations>(serverAllocations);
  const lastSavedRef = useRef<ConvictionAllocations>(serverAllocations);

  // Sync local state when the server state changes (initial load, post-save
  // refetch, or external invalidation).
  useEffect(() => {
    setLocalAllocations(serverAllocations);
    lastSavedRef.current = serverAllocations;
  }, [serverAllocations]);

  const isDirty = useMemo(() => {
    const ids = new Set([...Object.keys(localAllocations), ...Object.keys(lastSavedRef.current)]);
    for (const id of ids) {
      if ((localAllocations[id] ?? 0) !== (lastSavedRef.current[id] ?? 0)) return true;
    }
    return false;
  }, [localAllocations]);

  // Track the most-recent local-allocations snapshot for the debounced save
  // closure. Without the ref the setTimeout callback would close over a stale
  // value and submit the wrong deltas.
  const localAllocationsRef = useRef<ConvictionAllocations>(localAllocations);
  useEffect(() => {
    localAllocationsRef.current = localAllocations;
  }, [localAllocations]);

  const performSave = useCallback(() => {
    if (!poolAddress || power.pointsBudget <= 0n) return;
    const next = localAllocationsRef.current;
    const deltas = percentMapToSignedDeltas(lastSavedRef.current, next, power.pointsBudget);
    if (deltas.length === 0) return;

    // Optimistically mark as saved; the underlying mutation's onSuccess will
    // refetch the server state, which the useEffect above syncs back into
    // localAllocations. Errors leave local state ahead of server until the
    // user re-edits or the indexer-lag invalidation fires.
    lastSavedRef.current = { ...next };
    allocateMutation.mutate({
      poolAddress,
      signals: deltas.map((delta) => ({
        hypercertId: delta.hypercertId,
        deltaSupport: delta.deltaSupport,
      })),
    });
  }, [allocateMutation, poolAddress, power.pointsBudget]);

  const timeout = useTimeout();

  const setAllocations = useCallback(
    (next: ConvictionAllocations) => {
      setLocalAllocations(next);
      timeout.set(performSave, debounceMs);
    },
    [debounceMs, performSave, timeout]
  );

  const flush = useCallback(() => {
    timeout.clear();
    performSave();
  }, [performSave, timeout]);

  return {
    allocations: localAllocations,
    setAllocations,
    flush,
    isDirty,
    isSaving: allocateMutation.isPending,
    isLoading,
  };
}
