import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackStorageError } from "../../modules/app/error-tracking";
import { logger } from "../../modules/app/logger";
import type { Address } from "../../types/domain";
import type { AssessmentWorkflowParams } from "../../workflows/createAssessment";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssessmentDraftRecord extends AssessmentWorkflowParams {
  /** Composite key: `assessment_draft_${gardenId}_${operatorAddress}` */
  id: string;
  /** Garden address this draft belongs to */
  gardenId: Address;
  /** Operator who created the draft */
  operatorAddress: Address;
  /** Epoch ms when the draft was first created */
  createdAt: number;
  /** Epoch ms of the most recent save */
  updatedAt: number;
}

export interface UseAssessmentDraftResult {
  draftKey: string | null;
  isLoading: boolean;
  lastSavedAt: number | null;
  /** Reads the stored draft without applying it anywhere */
  peekDraft: () => Promise<AssessmentDraftRecord | null>;
  /** Reads the stored draft and returns it for the caller to apply */
  loadDraft: () => Promise<AssessmentDraftRecord | null>;
  /** Saves the given params as a draft */
  saveDraft: (params: AssessmentWorkflowParams) => Promise<AssessmentDraftRecord | null>;
  /** Deletes the stored draft */
  clearDraft: () => Promise<void>;
}

interface UseAssessmentDraftOptions {
  enabled?: boolean;
  /** Interval for periodic safety-net saves (default: 60000ms) */
  autoSaveIntervalMs?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDraftKey(gardenId?: string, operatorAddress?: string) {
  if (!gardenId || !operatorAddress) return null;
  return `assessment_draft_${gardenId}_${operatorAddress}`;
}

function hasMeaningfulProgress(params: AssessmentWorkflowParams): boolean {
  return (
    (params.title?.trim().length ?? 0) > 0 ||
    (params.description?.trim().length ?? 0) > 0 ||
    (params.assessmentType?.trim().length ?? 0) > 0 ||
    (typeof params.metrics === "string"
      ? params.metrics.trim().length > 0
      : params.metrics !== null &&
        params.metrics !== undefined &&
        Object.keys(params.metrics).length > 0) ||
    (params.location?.trim().length ?? 0) > 0
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAssessmentDraft(
  gardenId?: string,
  operatorAddress?: string,
  options: UseAssessmentDraftOptions = {}
): UseAssessmentDraftResult {
  const { enabled = true, autoSaveIntervalMs = 60_000 } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const draftKey = useMemo(
    () => buildDraftKey(gardenId, operatorAddress),
    [gardenId, operatorAddress]
  );

  // Track request ID to handle race conditions when gardenId/operatorAddress change rapidly
  const loadRequestIdRef = useRef(0);

  // Keep latest params for interval-based safety-net saves
  const latestParamsRef = useRef<AssessmentWorkflowParams | null>(null);

  // Cache createdAt from first load to avoid redundant IDB reads on every save
  const createdAtRef = useRef<number | null>(null);

  const peekDraft = useCallback(async () => {
    if (!draftKey || !enabled) return null;

    try {
      const stored = (await idbGet(draftKey)) as AssessmentDraftRecord | undefined;
      return stored ?? null;
    } catch (error) {
      logger.error("[useAssessmentDraft] Failed to peek draft", {
        source: "useAssessmentDraft.peekDraft",
        key: draftKey,
        error: error instanceof Error ? error.message : String(error),
      });
      trackStorageError(error, {
        source: "useAssessmentDraft.peekDraft",
        userAction: "checking assessment draft",
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
      const stored = (await idbGet(draftKey)) as AssessmentDraftRecord | undefined;
      // Ignore stale results if a newer request was started
      if (requestId !== loadRequestIdRef.current) return null;

      if (stored) {
        createdAtRef.current = stored.createdAt;
        setLastSavedAt(stored.updatedAt);
        return stored;
      }
      return null;
    } catch (error) {
      // Ignore errors from stale requests
      if (requestId !== loadRequestIdRef.current) return null;

      logger.error("[useAssessmentDraft] Failed to load draft", {
        source: "useAssessmentDraft.loadDraft",
        key: draftKey,
        error: error instanceof Error ? error.message : String(error),
      });
      trackStorageError(error, {
        source: "useAssessmentDraft.loadDraft",
        userAction: "loading assessment draft",
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

  const saveDraft = useCallback(
    async (params: AssessmentWorkflowParams) => {
      if (!draftKey || !gardenId || !operatorAddress || !enabled) return null;

      // Store latest params for interval saves
      latestParamsRef.current = params;

      if (!hasMeaningfulProgress(params)) return null;

      const now = Date.now();
      const createdAt = createdAtRef.current ?? now;
      // Cache on first save so subsequent saves skip IDB reads
      if (!createdAtRef.current) createdAtRef.current = createdAt;

      const draft: AssessmentDraftRecord = {
        ...params,
        id: draftKey,
        gardenId: gardenId as Address,
        operatorAddress: operatorAddress as Address,
        createdAt,
        updatedAt: now,
      };

      try {
        await idbSet(draftKey, draft);
        setLastSavedAt(now);
        return draft;
      } catch (error) {
        logger.error("[useAssessmentDraft] Failed to save draft", {
          source: "useAssessmentDraft.saveDraft",
          key: draftKey,
          error: error instanceof Error ? error.message : String(error),
        });
        trackStorageError(error, {
          source: "useAssessmentDraft.saveDraft",
          userAction: "saving assessment draft",
          recoverable: true,
          metadata: { key: draftKey },
        });
        return null;
      }
    },
    [draftKey, gardenId, operatorAddress, enabled]
  );

  const clearDraft = useCallback(async () => {
    if (!draftKey) return;
    try {
      await idbDel(draftKey);
      setLastSavedAt(null);
      latestParamsRef.current = null;
      createdAtRef.current = null;
    } catch (error) {
      logger.error("[useAssessmentDraft] Failed to clear draft", {
        source: "useAssessmentDraft.clearDraft",
        key: draftKey,
        error: error instanceof Error ? error.message : String(error),
      });
      trackStorageError(error, {
        source: "useAssessmentDraft.clearDraft",
        userAction: "clearing assessment draft",
        recoverable: true,
        metadata: { key: draftKey },
      });
    }
  }, [draftKey]);

  // Periodic safety-net saves
  useEffect(() => {
    if (!enabled || !draftKey) return;

    const interval = setInterval(() => {
      const params = latestParamsRef.current;
      if (params && hasMeaningfulProgress(params)) {
        void saveDraft(params);
      }
    }, autoSaveIntervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [enabled, draftKey, autoSaveIntervalMs, saveDraft]);

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
