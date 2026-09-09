import {
  captureWorkFile,
  identifyWorkFile,
  restoreWorkFile,
  validateWorkAttachments,
  validateWorkVideo,
} from "../../modules/work/work-attachments";
import { normalizeWorkMediaFiles } from "../../modules/work/media-processing";
import { queueDraftWrite } from "../../modules/work/draft-lifecycle";
import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Address, ApproximateWorkLocation } from "../../types/domain";
import type { DraftStep } from "../../types/job-queue";
import { draftDB, hasMeaningfulDraftDetails } from "../../modules/job-queue/draft-db";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import { requestPersistentStorageOnce } from "../../utils/storage/quota";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { draftsKeys } from "../../config/query-keys/misc";

interface DraftFormData {
  gardenAddress: Address | null;
  actionUID: number | null;
  feedback: string;
  details: Record<string, unknown>;
  timeSpentMinutes?: number;
  currentStep?: DraftStep;
  tags?: string[];
  audioNotes?: File[];
  location?: ApproximateWorkLocation;
}

export function useDraftAutoSave(
  formData: DraftFormData,
  images: File[] | undefined,
  options: { enabled?: boolean } = {}
) {
  const { primaryAddress: userAddress } = useUser();
  const chainId = useCurrentChain();
  const queryClient = useQueryClient();
  const deleting = useWorkFlowStore((state) => state.draftDeleting);
  const hydrated = useWorkFlowStore((state) => state.draftHydrated);
  const completed = useWorkFlowStore((state) => state.submissionCompleted);
  const activeDraftId = useWorkFlowStore((state) => state.activeDraftId);
  const missing = useWorkFlowStore((state) => state.draftMissingAttachments);
  const epoch = useWorkFlowStore((state) => state.draftEpoch);
  const latest = useRef({ formData, images: images ?? [], missing });
  if (
    latest.current.missing !== missing ||
    latest.current.images !== images ||
    latest.current.formData.audioNotes !== formData.audioNotes ||
    JSON.stringify({ ...latest.current.formData, audioNotes: undefined }) !==
      JSON.stringify({ ...formData, audioNotes: undefined })
  ) {
    latest.current = { formData, images: images ?? [], missing };
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const enabled = options.enabled !== false && hydrated && !deleting && !completed && !!userAddress;

  const saveOnExit = useCallback(async (): Promise<string | null> => {
    clearTimeout(timer.current);
    if (!enabled || !userAddress) return null;
    const snapshot = latest.current;
    const state = useWorkFlowStore.getState();
    const scope = `${userAddress.toLowerCase()}:${chainId}`;
    const generation = epoch;
    const isCurrent = () => {
      const current = useWorkFlowStore.getState();
      return (
        current.draftEpoch === generation &&
        current.draftScope === scope &&
        !current.draftDeleting &&
        !current.submissionCompleted
      );
    };
    if (!isCurrent()) return null;
    const { audioNotes = [], ...fields } = snapshot.formData;
    const meaningful =
      snapshot.images.length > 0 ||
      audioNotes.length > 0 ||
      !!fields.gardenAddress ||
      fields.actionUID !== null ||
      fields.feedback.trim() ||
      hasMeaningfulDraftDetails(fields.details) ||
      (fields.timeSpentMinutes ?? 0) > 0;
    if (!state.activeDraftId && !meaningful) {
      useWorkFlowStore.setState({ draftSaveState: "idle" });
      return null;
    }
    const draftId = state.activeDraftId ?? crypto.randomUUID();
    useWorkFlowStore.setState({
      activeDraftId: draftId,
      draftSaveState: "saving",
      draftError: null,
    });
    const task = queueDraftWrite(async () => {
      if (!isCurrent()) return null;
      try {
        const saved = await draftDB.saveSnapshot(
          userAddress,
          chainId,
          draftId,
          fields,
          snapshot.images,
          audioNotes,
          isCurrent,
          snapshot.missing
        );
        if (isCurrent() && latest.current === snapshot)
          useWorkFlowStore.setState({ draftSaveState: "saved" });
        if (isCurrent())
          void queryClient.invalidateQueries({ queryKey: draftsKeys.list(userAddress, chainId) });
        if (saved?.legacySourceId) {
          const { finishLegacyRecovery } = await import("../../modules/work/legacy-draft-recovery");
          await finishLegacyRecovery(saved);
        }
        void requestPersistentStorageOnce("work-draft");
        return draftId;
      } catch (error) {
        if (!isCurrent() || (error instanceof DOMException && error.name === "AbortError"))
          return null;
        useWorkFlowStore.setState({
          draftSaveState: "failed",
          draftError: error instanceof Error ? error.message : "draft-save-failed",
        });
        throw error;
      }
    });
    return task;
  }, [enabled, userAddress, chainId, queryClient, epoch]);

  useEffect(() => {
    clearTimeout(timer.current);
  }, [epoch]);

  const fieldsKey = JSON.stringify({ ...formData, audioNotes: undefined });
  const immediateKey = `${formData.gardenAddress}:${formData.actionUID}:${formData.currentStep}:${JSON.stringify(formData.location)}:${JSON.stringify(formData.tags)}`;
  const prior = useRef<
    | { key: string; images: File[] | undefined; audio: File[] | undefined; missing: string }
    | undefined
  >(undefined);
  const effectEpoch = useRef(epoch);
  const missingKey = missing.map((item) => item.id).join(":");
  useEffect(() => {
    const generationChanged = effectEpoch.current !== epoch;
    effectEpoch.current = epoch;
    if (!enabled || generationChanged) return;
    const previous = prior.current;
    const immediate =
      !previous ||
      previous.key !== immediateKey ||
      previous.images !== images ||
      previous.audio !== formData.audioNotes ||
      previous.missing !== missingKey;
    prior.current = { key: immediateKey, images, audio: formData.audioNotes, missing: missingKey };
    clearTimeout(timer.current);
    useWorkFlowStore.setState({ draftSaveState: "saving" });
    timer.current = setTimeout(
      () => {
        void saveOnExit().catch(() => undefined);
      },
      immediate ? 0 : 500
    );
    return () => clearTimeout(timer.current);
  }, [
    enabled,
    fieldsKey,
    immediateKey,
    images,
    formData.audioNotes,
    missingKey,
    saveOnExit,
    epoch,
  ]);

  useEffect(() => {
    const flush = () => {
      void saveOnExit().catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(timer.current);
      flush();
    };
  }, [saveOnExit]);

  return {
    saveOnExit,
    hasDraft: !!activeDraftId,
    draftId: activeDraftId,
    hasMeaningfulProgress: !!activeDraftId,
  };
}

export function useDraftSaveStatus() {
  const saveState = useWorkFlowStore((state) => state.draftSaveState);
  const error = useWorkFlowStore((state) => state.draftError);
  const missingAttachments = useWorkFlowStore((state) => state.draftMissingAttachments);
  return {
    saveState,
    error,
    missingAttachments,
    reselectMissingAttachment: async (id: string, pickerFile: File) => {
      const before = useWorkFlowStore.getState();
      const missing = before.draftMissingAttachments.find((item) => item.id === id);
      if (!missing) return;
      try {
        let file = await captureWorkFile(pickerFile);
        if (missing.kind !== "audio") {
          const normalized = await normalizeWorkMediaFiles([file]);
          if (normalized.accepted.length !== 1) throw new Error("media-type");
          file = normalized.accepted[0].file;
          if (file.type.startsWith("video/") && !(await validateWorkVideo(file)))
            throw new Error("video-duration");
        }
        const identity = await identifyWorkFile(file);
        const replacement = restoreWorkFile(identity.fileData, id, identity.contentHash);
        const current = useWorkFlowStore.getState();
        if (
          current.draftEpoch !== before.draftEpoch ||
          current.draftScope !== before.draftScope ||
          !current.draftMissingAttachments.some((item) => item.id === id)
        )
          return;
        const field = missing.kind === "audio" ? "audioNotes" : "images";
        const files = [...current[field]];
        const earlierMissing = current.draftMissingAttachments.filter(
          (item) => item.order < missing.order
        ).length;
        files.splice(
          Math.max(
            0,
            missing.order - earlierMissing - (field === "audioNotes" ? current.images.length : 0)
          ),
          0,
          replacement
        );
        if (
          validateWorkAttachments(
            field === "images" ? files : current.images,
            field === "audioNotes" ? files : current.audioNotes
          ).length
        )
          throw new Error("invalid-attachment");
        useWorkFlowStore.setState({
          [field]: files,
          draftMissingAttachments: current.draftMissingAttachments.filter((item) => item.id !== id),
          draftSaveState: "saving",
          draftError: null,
        });
      } catch (error) {
        if (useWorkFlowStore.getState().draftEpoch === before.draftEpoch)
          useWorkFlowStore.setState({
            draftSaveState: "failed",
            draftError: error instanceof Error ? error.message : "invalid-attachment",
          });
        throw error;
      }
    },
    removeMissingAttachment: (id: string) =>
      useWorkFlowStore.setState((state) => ({
        draftMissingAttachments: state.draftMissingAttachments.filter((item) => item.id !== id),
      })),
  };
}
