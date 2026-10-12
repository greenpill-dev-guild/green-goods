import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getTransactionScopeKey } from "../../modules/transactions/types";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { trackStorageError } from "../../modules/app/error-tracking";
import { logger } from "../../modules/app/logger";
import {
  type CreateGardenFormState,
  useCreateGardenStore,
} from "../../stores/useCreateGardenStore";
import type { Address } from "../../types/domain";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GardenDraft {
  /** Composite key: `garden_draft_${stewardAddress}` */
  id: string;
  chainId?: number;
  /** Steward who created the draft */
  stewardAddress: Address;
  /** Form fields snapshot */
  form: CreateGardenFormState;
  /** Current wizard step index */
  currentStep: number;
  /** Epoch ms when the draft was first created */
  createdAt: number;
  /** Epoch ms of the most recent save */
  updatedAt: number;
}

export interface UseGardenDraftResult {
  draftKey: string | null;
  isLoading: boolean;
  lastSavedAt: number | null;
  /** Reads the stored draft without applying it to the store */
  peekDraft: () => Promise<GardenDraft | null>;
  /** Reads the stored draft and applies it to the garden store */
  loadDraft: () => Promise<GardenDraft | null>;
  /** Persists the current garden store state as a draft */
  saveDraft: () => Promise<GardenDraft | null>;
  /** Deletes the stored draft */
  clearDraft: () => Promise<boolean>;
}

interface UseGardenDraftOptions {
  enabled?: boolean;
  chainId?: number;
  /** Debounce delay for auto-save after store changes (default: 2000ms) */
  autoSaveDebounceMs?: number;
  /** Interval for periodic safety-net saves (default: 60000ms) */
  autoSaveIntervalMs?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDraftKey(stewardAddress?: string, chainId?: number) {
  if (!stewardAddress) return null;
  return `garden_draft_${stewardAddress}${chainId === undefined ? "" : `_${chainId}`}`;
}

function hasMeaningfulProgress(form: CreateGardenFormState): boolean {
  return (
    form.name.trim().length > 0 ||
    form.slug.trim().length > 0 ||
    form.description.trim().length > 0 ||
    form.location.trim().length > 0 ||
    form.bannerImage.trim().length > 0 ||
    form.metadata.trim().length > 0 ||
    form.openJoining ||
    form.gardeners.length > 0 ||
    form.stewards.length > 0
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGardenDraft(
  stewardAddress?: string,
  options: UseGardenDraftOptions = {}
): UseGardenDraftResult {
  const {
    chainId,
    enabled = true,
    autoSaveDebounceMs = 2_000,
    autoSaveIntervalMs = 60_000,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const draftKey = useMemo(() => buildDraftKey(stewardAddress, chainId), [stewardAddress, chainId]);

  // Track request ID to handle race conditions when stewardAddress changes
  const loadRequestIdRef = useRef(0);

  // Cache createdAt from first load to avoid redundant IDB reads on every save
  const createdAtRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    loadRequestIdRef.current += 1;
    createdAtRef.current = null;
    setLastSavedAt(null);
    setIsLoading(false);
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [draftKey]);

  const readDraft = useCallback(async () => {
    if (!draftKey) return undefined;
    let stored = (await idbGet(draftKey)) as GardenDraft | undefined;
    const legacyKey = buildDraftKey(stewardAddress);
    if (!stored && chainId === DEFAULT_CHAIN_ID && legacyKey && legacyKey !== draftKey) {
      const legacy = (await idbGet(legacyKey)) as GardenDraft | undefined;
      if (legacy && legacy.stewardAddress?.toLowerCase() === stewardAddress?.toLowerCase()) {
        stored = { ...legacy, id: draftKey, chainId };
        await idbSet(draftKey, stored);
        await idbDel(legacyKey);
      }
    }
    return stored;
  }, [draftKey, chainId, stewardAddress]);

  const peekDraft = useCallback(async () => {
    if (!draftKey || !enabled) return null;

    try {
      const stored = await readDraft();
      return stored ?? null;
    } catch (error) {
      logger.error("[useGardenDraft] Failed to peek draft", {
        source: "useGardenDraft.peekDraft",
        key: draftKey,
        error: error instanceof Error ? error.message : String(error),
      });
      trackStorageError(error, {
        source: "useGardenDraft.peekDraft",
        userAction: "checking garden draft",
        recoverable: true,
        metadata: { key: draftKey },
      });
      return null;
    }
  }, [draftKey, enabled, readDraft]);

  const loadDraft = useCallback(async () => {
    if (!draftKey || !enabled) return null;

    const requestId = ++loadRequestIdRef.current;
    setIsLoading(true);
    try {
      const stored = await readDraft();
      // Ignore stale results if a newer request was started
      if (requestId !== loadRequestIdRef.current) return null;

      if (stored) {
        // Restore form state and step into the Zustand store
        useCreateGardenStore.setState({
          form: stored.form,
          currentStep: stored.currentStep,
        });
        createdAtRef.current = stored.createdAt;
        setLastSavedAt(stored.updatedAt);
        return stored;
      }
      return null;
    } catch (error) {
      // Ignore errors from stale requests
      if (requestId !== loadRequestIdRef.current) return null;

      logger.error("[useGardenDraft] Failed to load draft", {
        source: "useGardenDraft.loadDraft",
        key: draftKey,
        error: error instanceof Error ? error.message : String(error),
      });
      trackStorageError(error, {
        source: "useGardenDraft.loadDraft",
        userAction: "loading garden draft",
        recoverable: true,
        metadata: { key: draftKey },
      });
      return null;
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [draftKey, enabled, readDraft]);

  const saveDraft = useCallback(async () => {
    if (!draftKey || !stewardAddress || !enabled) return null;

    const state = useCreateGardenStore.getState();
    if (
      chainId !== undefined &&
      state.draftScope !== getTransactionScopeKey(stewardAddress as Address, chainId)
    )
      return null;
    if (!hasMeaningfulProgress(state.form)) return null;

    const scopeGeneration = loadRequestIdRef.current;
    const now = Date.now();
    const createdAt = createdAtRef.current ?? now;
    // Cache on first save so subsequent saves skip IDB reads
    if (!createdAtRef.current) createdAtRef.current = createdAt;

    const draft: GardenDraft = {
      id: draftKey,
      chainId,
      stewardAddress: stewardAddress as Address,
      form: state.form,
      currentStep: state.currentStep,
      createdAt,
      updatedAt: now,
    };

    try {
      await idbSet(draftKey, draft);
      if (scopeGeneration === loadRequestIdRef.current) setLastSavedAt(now);
      return draft;
    } catch (error) {
      logger.error("[useGardenDraft] Failed to save draft", {
        source: "useGardenDraft.saveDraft",
        key: draftKey,
        error: error instanceof Error ? error.message : String(error),
      });
      trackStorageError(error, {
        source: "useGardenDraft.saveDraft",
        userAction: "saving garden draft",
        recoverable: true,
        metadata: { key: draftKey },
      });
      return null;
    }
  }, [draftKey, stewardAddress, enabled, chainId]);

  const clearDraft = useCallback(async () => {
    if (!draftKey) return false;
    const scopeGeneration = loadRequestIdRef.current;
    try {
      await idbDel(draftKey);
      if (scopeGeneration !== loadRequestIdRef.current) return true;
      setLastSavedAt(null);
      createdAtRef.current = null;
      return true;
    } catch (error) {
      logger.error("[useGardenDraft] Failed to clear draft", {
        source: "useGardenDraft.clearDraft",
        key: draftKey,
        error: error instanceof Error ? error.message : String(error),
      });
      trackStorageError(error, {
        source: "useGardenDraft.clearDraft",
        userAction: "clearing garden draft",
        recoverable: true,
        metadata: { key: draftKey },
      });
      return false;
    }
  }, [draftKey]);

  // Subscribe to store changes and auto-save with debounce
  useEffect(() => {
    if (!enabled || !draftKey) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Selector for draft-relevant fields (form data + step)
    const selectDraftContent = (state: ReturnType<typeof useCreateGardenStore.getState>) => ({
      form: state.form,
      currentStep: state.currentStep,
    });

    // Equality check: form is a plain object replaced on every update,
    // so reference comparison on .form suffices
    const equalityFn = (
      a: ReturnType<typeof selectDraftContent>,
      b: ReturnType<typeof selectDraftContent>
    ): boolean => {
      return a.form === b.form && a.currentStep === b.currentStep;
    };

    const unsubscribe = useCreateGardenStore.subscribe((state, prevState) => {
      const next = selectDraftContent(state);
      const prev = selectDraftContent(prevState);
      if (equalityFn(prev, next)) return;

      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        void saveDraft();
      }, autoSaveDebounceMs);
    });

    // Periodic safety-net saves
    const interval = setInterval(() => {
      void saveDraft();
    }, autoSaveIntervalMs);

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [enabled, draftKey, autoSaveDebounceMs, autoSaveIntervalMs, saveDraft]);

  return useMemo(
    () => ({
      draftKey,
      isLoading,
      lastSavedAt,
      peekDraft,
      loadDraft,
      saveDraft,
      clearDraft,
    }),
    [draftKey, isLoading, lastSavedAt, peekDraft, loadDraft, saveDraft, clearDraft]
  );
}
