import {
  LEGACY_MEDIA_KEY,
  getLegacyRecoveryMarker,
  startLegacyRecovery,
  finishLegacyRecovery,
  discardUnrecoveredLegacy,
} from "../../modules/work/legacy-draft-recovery";
import type { MissingDraftAttachment } from "../../types/job-queue";
import { useCallback, useEffect, useRef, useState } from "react";
import { get } from "idb-keyval";
import { useDrafts } from "./useDrafts";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import { draftDB } from "../../modules/job-queue/draft-db";
import {
  captureWorkFile,
  identifyWorkFile,
  restoreWorkFile,
} from "../../modules/work/work-attachments";
import type { WorkFormData } from "./useWorkForm";

interface UseDraftResumeOptions {
  formState: {
    images: File[];
    gardenAddress: string | null;
    actionUID: number | null;
    feedback: string;
    timeSpentMinutes: number;
  };
  isOnIntroTab: boolean;
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams, options?: { replace?: boolean }) => void;
  restoreForm?: (values: WorkFormData) => void;
}
const LEGACY_KEY = LEGACY_MEDIA_KEY;

export function useDraftResume({
  searchParams,
  setSearchParams,
  restoreForm,
}: UseDraftResumeOptions) {
  const { resumeDraft, clearActiveDraft } = useDrafts();
  const { primaryAddress: userAddress } = useUser();
  const chainId = useCurrentChain();
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [legacyRecovery, setLegacyRecovery] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const hydrated = useWorkFlowStore((state) => state.draftHydrated);
  const explicitId = searchParams.get("draftId");
  const latest = useRef({ resumeDraft, restoreForm, searchParams, setSearchParams });
  latest.current = { resumeDraft, restoreForm, searchParams, setSearchParams };

  useEffect(() => {
    if (!userAddress) {
      if (useWorkFlowStore.getState().draftScope) {
        useWorkFlowStore.getState().reset();
        latest.current.restoreForm?.({ feedback: "" });
      }
      setShowDraftDialog(false);
      setLegacyRecovery(false);
      useWorkFlowStore.setState((state) => ({
        draftHydrated: false,
        draftScope: null,
        draftEpoch: state.draftEpoch + 1,
      }));
      return;
    }
    const scope = `${userAddress.toLowerCase()}:${chainId}`;
    setLegacyRecovery(false);
    setShowDraftDialog(false);
    const state = useWorkFlowStore.getState();
    if (state.draftScope === scope && state.draftHydrated && !explicitId) return;
    if (state.draftScope && state.draftScope !== scope) {
      state.reset();
      latest.current.restoreForm?.({ feedback: "" });
    }
    const controller = new AbortController();
    useWorkFlowStore.setState((current) => ({
      draftScope: scope,
      draftHydrated: false,
      draftEpoch: current.draftEpoch + 1,
      draftSaveState: "loading",
      draftError: null,
    }));
    void (async () => {
      try {
        const draftId = explicitId ?? (await draftDB.getActiveDraft(userAddress, chainId));
        controller.signal.throwIfAborted();
        if (draftId) {
          await latest.current.resumeDraft(draftId, {
            signal: controller.signal,
            restoreForm: latest.current.restoreForm,
          });
          if (!explicitId) setShowDraftDialog(true);
        } else {
          const legacy = await get<File[]>(LEGACY_KEY);
          controller.signal.throwIfAborted();
          const marker = await getLegacyRecoveryMarker();
          if (Array.isArray(legacy) && legacy.length && (!marker || marker.scope === scope)) {
            setLegacyRecovery(true);
            setShowDraftDialog(true);
          }
        }
        controller.signal.throwIfAborted();
        useWorkFlowStore.setState({
          draftHydrated: true,
          draftSaveState: draftId ? "saved" : "idle",
        });
        if (explicitId) {
          const params = new URLSearchParams(latest.current.searchParams);
          params.delete("draftId");
          latest.current.setSearchParams(params, { replace: true });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        useWorkFlowStore.setState({
          draftSaveState: "failed",
          draftError: error instanceof Error ? error.message : "draft-load-failed",
        });
      }
    })();
    return () => {
      controller.abort();
    };
  }, [userAddress, chainId, explicitId, loadAttempt]);

  const handleContinueDraft = useCallback(async () => {
    if (legacyRecovery && userAddress) {
      const epoch = useWorkFlowStore.getState().draftEpoch;
      const isCurrent = () =>
        useWorkFlowStore.getState().draftEpoch === epoch &&
        useWorkFlowStore.getState().draftScope === `${userAddress.toLowerCase()}:${chainId}`;
      const files = await get<File[]>(LEGACY_KEY);
      const marker = await startLegacyRecovery(
        files ?? [],
        `${userAddress.toLowerCase()}:${chainId}`
      );
      const existing = await draftDB.getDraft(marker.draftId);
      if (!isCurrent()) throw new DOMException("Account changed", "AbortError");
      if (existing) {
        await resumeDraft(existing.id, { restoreForm });
        await finishLegacyRecovery(existing);
      } else {
        const copied: File[] = [];
        const missing: MissingDraftAttachment[] = [];
        for (const entry of marker.entries) {
          try {
            const file = await captureWorkFile(files![entry.index]);
            const identity = await identifyWorkFile(file);
            copied.push(restoreWorkFile(identity.fileData, entry.id, identity.contentHash));
          } catch {
            missing.push({ id: entry.id, name: entry.name, order: entry.index, kind: "media" });
          }
        }
        const saved = await draftDB.saveSnapshot(
          userAddress,
          chainId,
          marker.draftId,
          { legacyRecovery: true, legacySourceId: marker.sourceId, legacyEntries: marker.entries },
          copied,
          [],
          isCurrent,
          missing
        );
        if (!isCurrent()) throw new DOMException("Account changed", "AbortError");
        await resumeDraft(marker.draftId, { restoreForm });
        if (saved) await finishLegacyRecovery(saved);
      }
      setLegacyRecovery(false);
    }
    setShowDraftDialog(false);
  }, [legacyRecovery, userAddress, chainId, resumeDraft, restoreForm]);

  const handleStartFresh = useCallback(async () => {
    const initial = useWorkFlowStore.getState();
    const scope = `${userAddress?.toLowerCase()}:${chainId}`;
    if (initial.draftScope !== scope) return;
    if (initial.activeDraftId) {
      await clearActiveDraft();
    } else {
      const generation = initial.draftEpoch + 1;
      useWorkFlowStore.setState({ draftEpoch: generation, draftDeleting: true });
      const current = () => {
        const state = useWorkFlowStore.getState();
        return state.draftScope === scope && state.draftEpoch === generation;
      };
      try {
        if (legacyRecovery) await discardUnrecoveredLegacy(scope);
        if (current()) {
          useWorkFlowStore.getState().reset();
          restoreForm?.({ feedback: "" });
        }
      } catch (error) {
        if (current())
          useWorkFlowStore.setState({ draftDeleting: false, draftSaveState: "failed" });
        throw error;
      }
    }
    if (useWorkFlowStore.getState().draftScope === scope) {
      setLegacyRecovery(false);
      setShowDraftDialog(false);
    }
  }, [legacyRecovery, clearActiveDraft, userAddress, chainId, restoreForm]);

  return {
    showDraftDialog,
    setShowDraftDialog,
    handleContinueDraft,
    handleStartFresh,
    clearActiveDraft,
    legacyRecovery,
    retryHydration: () => setLoadAttempt((attempt) => attempt + 1),
    isResumingFromUrl: !hydrated,
  };
}
