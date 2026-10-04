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
import { queueDraftWrite } from "../../modules/work/draft-lifecycle";
import {
  fromDraftWorkLink,
  hasWorkLinkIntentParams,
  parseWorkLinkIntent,
  toDraftWorkLink,
  type WorkLinkIntent,
  writeWorkLinkIntent,
} from "../../modules/commitment-pooling/work-link-intent";
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
  const [showDraftSheet, setSheet] = useState(false);
  // Closing the prompt, by any path, is the person's answer: the draft may be written again.
  const setShowDraftSheet = useCallback((open: boolean) => {
    if (!open) useWorkFlowStore.setState({ draftChoicePending: false });
    setSheet(open);
  }, []);
  const [legacyRecovery, setLegacyRecovery] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const hydrated = useWorkFlowStore((state) => state.draftHydrated);
  const explicitId = searchParams.get("draftId");
  const latest = useRef({ resumeDraft, restoreForm, searchParams, setSearchParams });
  latest.current = { resumeDraft, restoreForm, searchParams, setSearchParams };
  // Whether the page's promise came back from the resumed draft rather than the page's own link.
  const restoredLink = useRef(false);

  useEffect(() => {
    if (!userAddress) {
      if (useWorkFlowStore.getState().draftScope) {
        useWorkFlowStore.getState().reset();
        latest.current.restoreForm?.({ feedback: "" });
      }
      setShowDraftSheet(false);
      setLegacyRecovery(false);
      useWorkFlowStore.setState((state) => ({
        draftHydrated: false,
        draftScope: null,
        draftEpoch: state.draftEpoch + 1,
        draftPagePromise: null,
      }));
      return;
    }
    const scope = `${userAddress.toLowerCase()}:${chainId}`;
    setLegacyRecovery(false);
    setShowDraftSheet(false);
    const state = useWorkFlowStore.getState();
    if (state.draftScope === scope && state.draftHydrated && !explicitId) {
      // Still loaded from an earlier visit, so the page comes back as it was.
      // The URL doesn't, though: the draft's promise is put back into it, as a
      // resume does, or the work could upload without its link.
      const draftId = state.activeDraftId;
      if (
        !draftId ||
        state.draftLinkCleared ||
        hasWorkLinkIntentParams(latest.current.searchParams)
      )
        return;
      let cancelled = false;
      void draftDB
        .getDraft(draftId)
        .then((draft) => {
          const current = useWorkFlowStore.getState();
          if (cancelled || current.activeDraftId !== draftId || current.draftLinkCleared) return;
          const link = draft?.linkIntent ? fromDraftWorkLink(draft.linkIntent) : null;
          if (!link || hasWorkLinkIntentParams(latest.current.searchParams)) return;
          restoredLink.current = true;
          latest.current.setSearchParams(writeWorkLinkIntent(latest.current.searchParams, link), {
            replace: true,
          });
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }
    if (state.draftScope && state.draftScope !== scope) {
      state.reset();
      latest.current.restoreForm?.({ feedback: "" });
    }
    const controller = new AbortController();
    restoredLink.current = false;
    // The promise the last visit's page was opened for, if its prompt went unanswered. It is for
    // the same account, gives way to a draft or a promise this visit names itself, and is spent
    // once a load completes, so an interrupted load does not lose it.
    const pagePromise =
      state.draftPagePromise &&
      state.draftScope === scope &&
      !explicitId &&
      !hasWorkLinkIntentParams(latest.current.searchParams)
        ? fromDraftWorkLink(state.draftPagePromise)
        : null;
    useWorkFlowStore.setState((current) => ({
      draftScope: scope,
      draftHydrated: false,
      draftEpoch: current.draftEpoch + 1,
      draftSaveState: "loading",
      draftError: null,
      draftLinkCleared: false,
    }));
    void (async () => {
      try {
        const draftId = explicitId ?? (await draftDB.getActiveDraft(userAddress, chainId));
        controller.signal.throwIfAborted();
        // The draft brings back the promise it was for, unless the page was opened for one.
        let link: WorkLinkIntent | null = pagePromise;
        if (draftId) {
          await latest.current.resumeDraft(draftId, {
            signal: controller.signal,
            restoreForm: latest.current.restoreForm,
          });
          const kept = (await draftDB.getDraft(draftId))?.linkIntent;
          if (!link && kept && !hasWorkLinkIntentParams(latest.current.searchParams))
            link = fromDraftWorkLink(kept);
          if (!explicitId) setSheet(true);
        } else {
          const legacy = await get<File[]>(LEGACY_KEY);
          controller.signal.throwIfAborted();
          const marker = await getLegacyRecoveryMarker();
          if (Array.isArray(legacy) && legacy.length && (!marker || marker.scope === scope)) {
            setLegacyRecovery(true);
            setSheet(true);
          }
        }
        controller.signal.throwIfAborted();
        // A prompted draft is held in the same step that turns saving on. A save on arrival
        // would write the page's promise, garden and action onto it before the person answers.
        useWorkFlowStore.setState({
          draftHydrated: true,
          draftSaveState: draftId ? "saved" : "idle",
          draftChoicePending: Boolean(draftId) && !explicitId,
          draftPagePromise: null,
        });
        if (explicitId || link) {
          const params = link
            ? writeWorkLinkIntent(latest.current.searchParams, link)
            : new URLSearchParams(latest.current.searchParams);
          params.delete("draftId");
          restoredLink.current = Boolean(link) && link !== pagePromise;
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
  }, [userAddress, chainId, explicitId, loadAttempt, setShowDraftSheet]);

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
    setShowDraftSheet(false);
  }, [legacyRecovery, userAddress, chainId, resumeDraft, restoreForm, setShowDraftSheet]);

  const handleStartFresh = useCallback(async () => {
    const scope = `${userAddress?.toLowerCase()}:${chainId}`;
    if (!userAddress || useWorkFlowStore.getState().draftScope !== scope) return;
    // A saved draft is set aside, not deleted, so the new work needs a draft slot of its own.
    if (
      !legacyRecovery &&
      useWorkFlowStore.getState().activeDraftId &&
      (await draftDB.isAtDraftLimit(userAddress, chainId))
    )
      throw new Error("draft-limit");
    const initial = useWorkFlowStore.getState();
    if (initial.draftScope !== scope) return;
    if (legacyRecovery && initial.activeDraftId) {
      // Photos recovered from before the account keep their explicit Discard.
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
        // The draft stays in Your Work as it was saved. The wizard stops reopening on it, once any
        // save still writing has finished, so that save can't point the wizard back at it.
        else if (initial.activeDraftId) {
          const setAside = initial.activeDraftId;
          await queueDraftWrite(() => draftDB.releaseActiveDraft(userAddress, chainId, setAside));
        }
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
      setShowDraftSheet(false);
      // A promise that came back with the old draft goes with it; one the page was opened for stays.
      if (restoredLink.current) {
        restoredLink.current = false;
        const { searchParams: params, setSearchParams: write } = latest.current;
        write(writeWorkLinkIntent(params, null), { replace: true });
      }
    }
  }, [legacyRecovery, clearActiveDraft, userAddress, chainId, restoreForm, setShowDraftSheet]);

  return {
    showDraftSheet,
    setShowDraftSheet,
    handleContinueDraft,
    handleStartFresh,
    /**
     * Leaving while the prompt is still open: the next visit loads the draft and asks again, for
     * the promise this page was opened for. Returns whether Back must not reopen this address,
     * which is when the promise in it is the draft's and would read as the page's own.
     */
    askAgainNextVisit: () => {
      if (!showDraftSheet) return false;
      const own = restoredLink.current ? null : parseWorkLinkIntent(latest.current.searchParams);
      useWorkFlowStore.setState({
        draftHydrated: false,
        draftPagePromise: own ? toDraftWorkLink(own) : null,
      });
      return restoredLink.current;
    },
    clearActiveDraft,
    legacyRecovery,
    retryHydration: () => setLoadAttempt((attempt) => attempt + 1),
    isResumingFromUrl: !hydrated,
  };
}
