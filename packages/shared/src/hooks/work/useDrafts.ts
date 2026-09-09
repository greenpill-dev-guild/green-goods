import { deleteWorkDraft } from "../../modules/work/draft-lifecycle";
/**
 * Work Drafts Hook
 *
 * Manages work submission drafts with IndexedDB persistence.
 * Provides CRUD operations for drafts and integrates with WorkFlowStore.
 *
 * @module hooks/work/useDrafts
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkPreviewUrls } from "./useWorkImages";
import { computeFirstIncompleteStep, draftDB } from "../../modules/job-queue/draft-db";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import { WorkTab } from "../../stores/workFlowTypes";
import type { DraftStep, WorkDraftRecord, MissingDraftAttachment } from "../../types/job-queue";
import type { WorkFormData } from "./useWorkForm";
import { createDraftErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { draftsKeys } from "../../config/query-keys/misc";

/**
 * Map DraftStep to WorkTab enum
 */
function draftStepToWorkTab(step: DraftStep): WorkTab {
  switch (step) {
    case "intro":
      return WorkTab.Intro;
    case "media":
      return WorkTab.Media;
    case "details":
      return WorkTab.Details;
    case "review":
      return WorkTab.Review;
  }
}

export interface DraftWithImages extends WorkDraftRecord {
  images: Array<{ id: string; file: File; url: string }>;
  thumbnailUrl: string | null;
}

interface ResumeDraftOptions {
  signal?: AbortSignal;
  restoreForm?: (values: WorkFormData) => void;
}

/**
 * Hook for managing work drafts
 */
export function useDrafts() {
  const queryClient = useQueryClient();
  const { primaryAddress: userAddress } = useUser();
  const chainId = useCurrentChain();

  // Track the current active draft ID
  const activeDraftId = useWorkFlowStore((state) => state.activeDraftId);
  const setActiveDraftId = useCallback((id: string | null) => {
    useWorkFlowStore.setState({ activeDraftId: id });
  }, []);

  // Query: Get all drafts for user
  const {
    data: drafts = [],
    isLoading,
    refetch: refetchDrafts,
  } = useQuery({
    queryKey: draftsKeys.list(userAddress || "", chainId),
    queryFn: async (): Promise<DraftWithImages[]> => {
      if (!userAddress) return [];

      const rawDrafts = await draftDB.getDraftsForUser(userAddress, chainId);

      return rawDrafts.map((draft) => ({ ...draft, images: [], thumbnailUrl: null }));
    },
    enabled: !!userAddress,
    staleTime: 1000 * 60, // 1 minute
  });

  // Mutation: Create draft
  const createDraftMutation = useMutation({
    mutationFn: async (
      data: Partial<
        Omit<WorkDraftRecord, "id" | "userAddress" | "chainId" | "createdAt" | "updatedAt">
      >
    ) => {
      if (!userAddress) throw new Error("User not authenticated");
      return await draftDB.createDraft(userAddress, chainId, data);
    },
    onSuccess: (draftId) => {
      setActiveDraftId(draftId);
      queryClient.invalidateQueries({
        queryKey: draftsKeys.list(userAddress || "", chainId),
      });
    },
    onError: createDraftErrorHandler("create"),
  });

  // Mutation: Update draft
  const updateDraftMutation = useMutation({
    mutationFn: async ({
      draftId,
      data,
    }: {
      draftId: string;
      data: Partial<Omit<WorkDraftRecord, "id" | "userAddress" | "chainId" | "createdAt">>;
    }) => {
      await draftDB.updateDraft(draftId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: draftsKeys.list(userAddress || "", chainId),
      });
    },
    onError: createDraftErrorHandler("save"),
  });

  // Mutation: Delete draft
  const deleteDraftMutation = useMutation({
    mutationFn: (draftId: string) => deleteWorkDraft(draftId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: draftsKeys.list(userAddress || "", chainId),
      });
    },
    onError: createDraftErrorHandler("delete"),
  });

  // Mutation: Add image to draft
  const addImageMutation = useMutation({
    mutationFn: async ({ draftId, file }: { draftId: string; file: File }) => {
      return await draftDB.addImageToDraft(draftId, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: draftsKeys.list(userAddress || "", chainId),
      });
    },
    onError: createDraftErrorHandler("add image to"),
  });

  // Mutation: Remove image from draft
  const removeImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      await draftDB.removeImageFromDraft(imageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: draftsKeys.list(userAddress || "", chainId),
      });
    },
    onError: createDraftErrorHandler("remove image from"),
  });

  // Mutation: Set images for draft (replaces all)
  const setImagesMutation = useMutation({
    mutationFn: async ({ draftId, files }: { draftId: string; files: File[] }) => {
      await draftDB.setImagesForDraft(draftId, files);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: draftsKeys.list(userAddress || "", chainId),
      });
    },
    onError: createDraftErrorHandler("save images for"),
  });

  /**
   * Resume a draft - load it into WorkFlowStore and navigate to first incomplete step
   * @param draftId - The draft ID to resume
   * @param options - Optional configuration including AbortSignal for cancellation
   */
  const resumeDraft = useCallback(
    async (draftId: string, options?: ResumeDraftOptions): Promise<WorkTab> => {
      const generation = useWorkFlowStore.getState().draftEpoch;
      const checkCurrent = () => {
        options?.signal?.throwIfAborted();
        const state = useWorkFlowStore.getState();
        if (
          state.draftEpoch !== generation ||
          (state.draftScope && state.draftScope !== `${userAddress?.toLowerCase()}:${chainId}`)
        )
          throw new DOMException("Draft changed", "AbortError");
      };
      checkCurrent();

      const draft = await draftDB.getDraft(draftId);
      if (!draft) throw new Error(`Draft ${draftId} not found`);
      if (
        !userAddress ||
        draft.userAddress.toLowerCase() !== userAddress.toLowerCase() ||
        draft.chainId !== chainId
      )
        throw new Error("draft-owner");

      // Check abort after async operation
      options?.signal?.throwIfAborted();

      const missing: MissingDraftAttachment[] = [...(draft.missingAttachments ?? [])];
      const images = await draftDB.getImagesForDraft(draftId, (attachment) => {
        if (!missing.some((item) => item.id === attachment.id)) missing.push(attachment);
      });
      const files = images.filter((img) => img.kind !== "audio").map((img) => img.file);

      // Check abort after async operation
      options?.signal?.throwIfAborted();
      checkCurrent();
      await draftDB.setActiveDraft(userAddress, chainId, draftId);
      checkCurrent();

      // Load draft data into WorkFlowStore
      const store = useWorkFlowStore.getState();
      store.setGardenAddress(draft.gardenAddress);
      store.setActionUID(draft.actionUID);
      store.setFeedback(draft.feedback);
      store.setDetails(draft.details ?? {});
      store.setTimeSpentMinutes(draft.timeSpentMinutes);
      store.setImages(files);
      store.setAudioNotes(images.filter((img) => img.kind === "audio").map((img) => img.file));
      store.setTags(draft.tags ?? []);
      useWorkFlowStore.setState({ location: draft.location, draftMissingAttachments: missing });
      options?.restoreForm?.({
        ...(draft.details ?? {}),
        location: draft.location,
        feedback: draft.feedback,
        ...(typeof draft.timeSpentMinutes === "number"
          ? { timeSpentMinutes: draft.timeSpentMinutes / 60 }
          : {}),
      });

      // Set active draft
      setActiveDraftId(draftId);

      // Calculate and return the first incomplete step
      const firstIncomplete = computeFirstIncompleteStep(draft, images.length > 0);
      const targetTab = draftStepToWorkTab(firstIncomplete);
      store.setActiveTab(targetTab);

      return targetTab;
    },
    [userAddress, chainId, setActiveDraftId]
  );

  /**
   * Clear active draft on submission complete
   */
  const clearActiveDraft = useCallback(
    async (mode: "discard" | "retire" = "discard") => {
      const id = useWorkFlowStore.getState().activeDraftId;
      if (!id) return;
      await deleteWorkDraft(id, mode);
      await queryClient.invalidateQueries({
        queryKey: draftsKeys.list(userAddress || "", chainId),
      });
    },
    [queryClient, userAddress, chainId]
  );

  /**
   * Get active draft with images
   */
  const getActiveDraft = useCallback(async (): Promise<DraftWithImages | null> => {
    if (!activeDraftId) return null;

    const draft = await draftDB.getDraft(activeDraftId);
    if (!draft) return null;

    const images = await draftDB.getImagesForDraft(activeDraftId);
    return {
      ...draft,
      images,
      thumbnailUrl: images.find((image) => image.file.type.startsWith("image/"))?.url || null,
    };
  }, [activeDraftId]);

  return {
    // State
    drafts,
    activeDraftId,
    isLoading,
    draftCount: drafts.length,

    // Actions
    createDraft: createDraftMutation.mutateAsync,
    updateDraft: updateDraftMutation.mutateAsync,
    deleteDraft: deleteDraftMutation.mutateAsync,
    addImage: addImageMutation.mutateAsync,
    removeImage: removeImageMutation.mutateAsync,
    setImages: setImagesMutation.mutateAsync,

    // High-level operations
    resumeDraft,
    clearActiveDraft,
    getActiveDraft,
    setActiveDraftId,
    refetchDrafts,

    // Mutation states
    isCreating: createDraftMutation.isPending,
    isUpdating: updateDraftMutation.isPending,
    isDeleting: deleteDraftMutation.isPending,
  };
}

export type UseDraftsReturn = ReturnType<typeof useDrafts>;

/** A mounted card loads one photo only while it is visible. */
export function useDraftThumbnail(draft: WorkDraftRecord) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const attachmentId = draft.thumbnail?.attachmentId;
  const hash = draft.thumbnail?.contentHash;
  useEffect(() => {
    if (!ref.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    setFile(null);
    if (visible)
      void draftDB
        .getThumbnailFile(latestDraft.current)
        .then((value) => {
          if (active) setFile(value);
        })
        .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [visible, draft.id, attachmentId, hash]);
  const files = useMemo(() => (file ? [file] : []), [file]);
  const urls = useWorkPreviewUrls(files);
  return { ref, url: urls[0] ?? null };
}
