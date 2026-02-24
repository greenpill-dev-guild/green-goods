import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Address } from "../../types/domain";
import { logger } from "../../modules/app/logger";
import { trackStorageError } from "../../modules/app/error-tracking";
import {
  type CreateGardenFormState,
  useCreateGardenStore,
} from "../../stores/useCreateGardenStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GardenDraft {
  /** Composite key: `garden_draft_${operatorAddress}` */
  id: string;
  /** Operator who created the draft */
  operatorAddress: Address;
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
  clearDraft: () => Promise<void>;
}

interface UseGardenDraftOptions {
  enabled?: boolean;
  /** Debounce delay for auto-save after store changes (default: 2000ms) */
  autoSaveDebounceMs?: number;
  /** Interval for periodic safety-net saves (default: 60000ms) */
  autoSaveIntervalMs?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDraftKey(operatorAddress?: string) {
  if (!operatorAddress) return null;
  return `garden_draft_${operatorAddress}`;
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
    form.operators.length > 0
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGardenDraft(
  operatorAddress?: string,
  options: UseGardenDraftOptions = {}
): UseGardenDraftResult {
  const { enabled = true, autoSaveDebounceMs = 2_000, autoSaveIntervalMs = 60_000 } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const draftKey = useMemo(() => buildDraftKey(operatorAddress), [operatorAddress]);

  // Track request ID to handle race conditions when operatorAddress changes
  const loadRequestIdRef = useRef(0);

  // Cache createdAt from first load to avoid redundant IDB reads on every save
  const createdAtRef = useRef<number | null>(null);

  const peekDraft = useCallback(async () => {
    if (!draftKey || !enabled) return null;

    try {
      const stored = (await idbGet(draftKey)) as GardenDraft | undefined;
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
  }, [draftKey, enabled]);

  const loadDraft = useCallback(async () => {
    if (!draftKey || !enabled) return null;

    const requestId = ++loadRequestIdRef.current;
    setIsLoading(true);
    try {
      const stored = (await idbGet(draftKey)) as GardenDraft | undefined;
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
  }, [draftKey, enabled]);

  const saveDraft = useCallback(async () => {
    if (!draftKey || !operatorAddress || !enabled) return null;

    const state = useCreateGardenStore.getState();
    if (!hasMeaningfulProgress(state.form)) return null;

    const now = Date.now();
    const createdAt = createdAtRef.current ?? now;
    // Cache on first save so subsequent saves skip IDB reads
    if (!createdAtRef.current) createdAtRef.current = createdAt;

    const draft: GardenDraft = {
      id: draftKey,
      operatorAddress: operatorAddress as Address,
      form: state.form,
      currentStep: state.currentStep,
      createdAt,
      updatedAt: now,
    };

    try {
      await idbSet(draftKey, draft);
      setLastSavedAt(now);
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
  }, [draftKey, operatorAddress, enabled]);

  const clearDraft = useCallback(async () => {
    if (!draftKey) return;
    try {
      await idbDel(draftKey);
      setLastSavedAt(null);
      createdAtRef.current = null;
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
