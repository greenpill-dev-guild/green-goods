import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { HypercertDraft } from "../../types/hypercerts";
import { logger } from "../../modules/app/logger";
import { trackStorageError } from "../../modules/app/error-tracking";
import { useHypercertWizardStore } from "../../stores/useHypercertWizardStore";

export interface UseHypercertDraftResult {
  draftKey: string | null;
  isLoading: boolean;
  lastSavedAt: number | null;
  /** Reads the stored draft without applying it to the wizard store */
  peekDraft: () => Promise<HypercertDraft | null>;
  loadDraft: () => Promise<HypercertDraft | null>;
  saveDraft: () => Promise<HypercertDraft | null>;
  clearDraft: () => Promise<void>;
}

interface UseHypercertDraftOptions {
  enabled?: boolean;
  /** Automatically load stored draft into the wizard store (default: true) */
  autoLoad?: boolean;
  /** Debounce delay for auto-save after user stops typing (default: 2000ms) */
  autoSaveDebounceMs?: number;
  /** Interval for periodic safety-net saves (default: 60000ms) */
  autoSaveIntervalMs?: number;
}

function buildDraftKey(gardenId?: string, operatorAddress?: string) {
  if (!gardenId || !operatorAddress) return null;
  return `hypercert_draft_${gardenId}_${operatorAddress}`;
}

function hasMeaningfulProgress(draft: HypercertDraft): boolean {
  return (
    draft.attestationIds.length > 0 ||
    draft.title.trim().length > 0 ||
    draft.description.trim().length > 0 ||
    draft.workScopes.length > 0 ||
    draft.impactScopes.length > 0 ||
    draft.allowlist.length > 0
  );
}

export function useHypercertDraft(
  gardenId?: string,
  operatorAddress?: string,
  options: UseHypercertDraftOptions = {}
): UseHypercertDraftResult {
  const {
    enabled = true,
    autoLoad = true,
    autoSaveDebounceMs = 2_000,
    autoSaveIntervalMs = 60_000,
  } = options;
  const [isLoading, setIsLoading] = useState(false);

  const draftKey = useMemo(
    () => buildDraftKey(gardenId, operatorAddress),
    [gardenId, operatorAddress]
  );

  const loadDraftFromStore = useHypercertWizardStore((state) => state.loadDraft);
  const setDraftMeta = useHypercertWizardStore((state) => state.setDraftMeta);
  const resetStore = useHypercertWizardStore((state) => state.reset);
  const lastSavedAt = useHypercertWizardStore((state) => state.lastSavedAt);

  // Track request ID to handle race conditions when gardenId/operatorAddress change rapidly
  const loadRequestIdRef = useRef(0);

  const peekDraft = useCallback(async () => {
    if (!draftKey || !enabled) return null;

    try {
      const stored = (await idbGet(draftKey)) as HypercertDraft | undefined;
      return stored ?? null;
    } catch (error) {
      logger.error("[useHypercertDraft] Failed to peek draft", {
        source: "useHypercertDraft.peekDraft",
        key: draftKey,
        error: error instanceof Error ? error.message : String(error),
      });
      trackStorageError(error, {
        source: "useHypercertDraft.peekDraft",
        userAction: "checking hypercert draft",
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
      const stored = (await idbGet(draftKey)) as HypercertDraft | undefined;
      // Ignore stale results if a newer request was started
      if (requestId !== loadRequestIdRef.current) return null;

      if (stored) {
        loadDraftFromStore(stored);
        setDraftMeta(stored.id, stored.updatedAt);
        return stored;
      }
      return null;
    } catch (error) {
      // Ignore errors from stale requests
      if (requestId !== loadRequestIdRef.current) return null;

      logger.error("[useHypercertDraft] Failed to load draft", {
        source: "useHypercertDraft.loadDraft",
        key: draftKey,
        error: error instanceof Error ? error.message : String(error),
      });
      trackStorageError(error, {
        source: "useHypercertDraft.loadDraft",
        userAction: "loading hypercert draft",
        recoverable: true,
        metadata: { key: draftKey },
      });
      return null;
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [draftKey, enabled, loadDraftFromStore, setDraftMeta]);

  const saveDraft = useCallback(async () => {
    if (!draftKey || !gardenId || !operatorAddress || !enabled) return null;

    const draft = useHypercertWizardStore
      .getState()
      .toDraft(gardenId, operatorAddress as `0x${string}`);

    if (!hasMeaningfulProgress(draft)) return null;

    try {
      await idbSet(draftKey, draft);
      setDraftMeta(draft.id, draft.updatedAt);
      return draft;
    } catch (error) {
      logger.error("[useHypercertDraft] Failed to save draft", {
        source: "useHypercertDraft.saveDraft",
        key: draftKey,
        error: error instanceof Error ? error.message : String(error),
      });
      trackStorageError(error, {
        source: "useHypercertDraft.saveDraft",
        userAction: "saving hypercert draft",
        recoverable: true,
        metadata: { key: draftKey },
      });
      return null;
    }
  }, [draftKey, gardenId, operatorAddress, enabled, setDraftMeta]);

  const clearDraft = useCallback(async () => {
    if (!draftKey) return;
    try {
      await idbDel(draftKey);
      resetStore();
      setDraftMeta(null, null);
    } catch (error) {
      logger.error("[useHypercertDraft] Failed to clear draft", {
        source: "useHypercertDraft.clearDraft",
        key: draftKey,
        error: error instanceof Error ? error.message : String(error),
      });
      trackStorageError(error, {
        source: "useHypercertDraft.clearDraft",
        userAction: "clearing hypercert draft",
        recoverable: true,
        metadata: { key: draftKey },
      });
    }
  }, [draftKey, resetStore, setDraftMeta]);

  useEffect(() => {
    if (!enabled || !autoLoad) return;
    void loadDraft();
  }, [autoLoad, enabled, loadDraft]);

  useEffect(() => {
    if (!enabled || !draftKey) return;

    // Subscribe to store changes with short debounce for responsive auto-save
    // Only trigger on draft-relevant fields to avoid unnecessary saves from UI state changes
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Selector for draft-relevant fields only (excludes UI state like currentStep, mintingState)
    const selectDraftContent = (state: ReturnType<typeof useHypercertWizardStore.getState>) => ({
      title: state.title,
      description: state.description,
      selectedAttestationIds: state.selectedAttestationIds,
      workScopes: state.workScopes,
      impactScopes: state.impactScopes,
      workTimeframeStart: state.workTimeframeStart,
      workTimeframeEnd: state.workTimeframeEnd,
      impactTimeframeStart: state.impactTimeframeStart,
      impactTimeframeEnd: state.impactTimeframeEnd,
      sdgs: state.sdgs,
      capitals: state.capitals,
      outcomes: state.outcomes,
      externalUrl: state.externalUrl,
      distributionMode: state.distributionMode,
      allowlist: state.allowlist,
    });

    // Custom equality function that checks if any draft-relevant field changed
    const equalityFn = (
      a: ReturnType<typeof selectDraftContent>,
      b: ReturnType<typeof selectDraftContent>
    ): boolean => {
      return (
        a.title === b.title &&
        a.description === b.description &&
        a.externalUrl === b.externalUrl &&
        a.workTimeframeStart === b.workTimeframeStart &&
        a.workTimeframeEnd === b.workTimeframeEnd &&
        a.impactTimeframeStart === b.impactTimeframeStart &&
        a.impactTimeframeEnd === b.impactTimeframeEnd &&
        a.distributionMode === b.distributionMode &&
        // For arrays, compare by reference (zustand replaces arrays on change)
        a.selectedAttestationIds === b.selectedAttestationIds &&
        a.workScopes === b.workScopes &&
        a.impactScopes === b.impactScopes &&
        a.sdgs === b.sdgs &&
        a.capitals === b.capitals &&
        a.allowlist === b.allowlist &&
        // For objects, compare by reference
        a.outcomes === b.outcomes
      );
    };

    const unsubscribe = useHypercertWizardStore.subscribe(
      selectDraftContent,
      () => {
        // Clear any pending save
        if (timeoutId) clearTimeout(timeoutId);

        // Short debounce: save after user stops typing (default 2s)
        timeoutId = setTimeout(() => {
          void saveDraft();
        }, autoSaveDebounceMs);
      },
      { equalityFn }
    );

    // Periodic safety-net saves at longer interval (default 60s)
    const interval = setInterval(() => {
      void saveDraft();
    }, autoSaveIntervalMs);

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [enabled, draftKey, autoSaveDebounceMs, autoSaveIntervalMs, saveDraft]);

  return {
    draftKey,
    isLoading,
    lastSavedAt,
    peekDraft,
    loadDraft,
    saveDraft,
    clearDraft,
  };
}
