/**
 * Work Drafts Hook
 *
 * Manages work submission drafts with IndexedDB persistence.
 * Provides CRUD operations for drafts and integrates with WorkFlowStore.
 *
 * @module hooks/work/useDrafts
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { computeFirstIncompleteStep, draftDB } from "../../modules/job-queue/draft-db";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import { WorkTab } from "../../stores/workFlowTypes";
import type { DraftStep, WorkDraft } from "../../types/job-queue";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { queryKeys } from "../query-keys";

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

/**
 * Map WorkTab to DraftStep
 */
function workTabToDraftStep(tab: WorkTab): DraftStep {
  switch (tab) {
    case WorkTab.Intro:
      return "intro";
    case WorkTab.Media:
      return "media";
    case WorkTab.Details:
      return "details";
    case WorkTab.Review:
      return "review";
  }
}

export interface DraftWithImages extends WorkDraft {
  images: Array<{ id: string; file: File; url: string }>;
  thumbnailUrl: string | null;
}

/**
 * Hook for managing work drafts
 */
export function useDrafts() {
  const queryClient = useQueryClient();
  const { primaryAddress: userAddress } = useUser();
  const chainId = useCurrentChain();

  // Track the current active draft ID
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // Query: Get all drafts for user
  const {
    data: drafts = [],
    isLoading,
    refetch: refetchDrafts,
  } = useQuery({
    queryKey: queryKeys.drafts.list(userAddress || "", chainId),
    queryFn: async (): Promise<DraftWithImages[]> => {
      if (!userAddress) return [];

      const rawDrafts = await draftDB.getDraftsForUser(userAddress, chainId);

      // Load images for each draft
      const draftsWithImages = await Promise.all(
        rawDrafts.map(async (draft) => {
          const images = await draftDB.getImagesForDraft(draft.id);
          return {
            ...draft,
            images,
            thumbnailUrl: images[0]?.url || null,
          };
        })
      );

      // Filter out drafts with no meaningful progress
      return draftsWithImages.filter((d) => d.images.length > 0 || d.feedback.trim().length > 0);
    },
    enabled: !!userAddress,
    staleTime: 1000 * 60, // 1 minute
  });

  // Mutation: Create draft
  const createDraftMutation = useMutation({
    mutationFn: async (
      data: Partial<Omit<WorkDraft, "id" | "userAddress" | "chainId" | "createdAt" | "updatedAt">>
    ) => {
      if (!userAddress) throw new Error("User not authenticated");
      return await draftDB.createDraft(userAddress, chainId, data);
    },
    onSuccess: (draftId) => {
      setActiveDraftId(draftId);
      queryClient.invalidateQueries({
        queryKey: queryKeys.drafts.list(userAddress || "", chainId),
      });
    },
  });

  // Mutation: Update draft
  const updateDraftMutation = useMutation({
    mutationFn: async ({
      draftId,
      data,
    }: {
      draftId: string;
      data: Partial<Omit<WorkDraft, "id" | "userAddress" | "chainId" | "createdAt">>;
    }) => {
      await draftDB.updateDraft(draftId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.drafts.list(userAddress || "", chainId),
      });
    },
  });

  // Mutation: Delete draft
  const deleteDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      await draftDB.deleteDraft(draftId);
      if (activeDraftId === draftId) {
        setActiveDraftId(null);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.drafts.list(userAddress || "", chainId),
      });
    },
  });

  // Mutation: Add image to draft
  const addImageMutation = useMutation({
    mutationFn: async ({ draftId, file }: { draftId: string; file: File }) => {
      return await draftDB.addImageToDraft(draftId, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.drafts.list(userAddress || "", chainId),
      });
    },
  });

  // Mutation: Remove image from draft
  const removeImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      await draftDB.removeImageFromDraft(imageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.drafts.list(userAddress || "", chainId),
      });
    },
  });

  // Mutation: Set images for draft (replaces all)
  const setImagesMutation = useMutation({
    mutationFn: async ({ draftId, files }: { draftId: string; files: File[] }) => {
      await draftDB.setImagesForDraft(draftId, files);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.drafts.list(userAddress || "", chainId),
      });
    },
  });

  /**
   * Create a new draft or get existing one for the current garden/action
   */
  const createOrGetDraft = useCallback(
    async (gardenAddress: string | null, actionUID: number | null): Promise<string> => {
      if (!userAddress) throw new Error("User not authenticated");

      // Check if there's already an active draft for this garden/action
      const existingDrafts = await draftDB.getDraftsForUser(userAddress, chainId);
      const existing = existingDrafts.find(
        (d) => d.gardenAddress === gardenAddress && d.actionUID === actionUID
      );

      if (existing) {
        setActiveDraftId(existing.id);
        return existing.id;
      }

      // Create new draft
      const draftId = await createDraftMutation.mutateAsync({
        gardenAddress,
        actionUID,
        currentStep: "intro",
        firstIncompleteStep: "intro",
      });

      return draftId;
    },
    [userAddress, chainId, createDraftMutation]
  );

  /**
   * Resume a draft - load it into WorkFlowStore and navigate to first incomplete step
   */
  const resumeDraft = useCallback(async (draftId: string): Promise<WorkTab> => {
    const draft = await draftDB.getDraft(draftId);
    if (!draft) throw new Error(`Draft ${draftId} not found`);

    const images = await draftDB.getImagesForDraft(draftId);
    const files = images.map((img) => img.file);

    // Load draft data into WorkFlowStore
    const store = useWorkFlowStore.getState();
    store.setGardenAddress(draft.gardenAddress);
    store.setActionUID(draft.actionUID);
    store.setFeedback(draft.feedback);
    store.setPlantSelection(draft.plantSelection);
    store.setPlantCount(draft.plantCount);
    store.setImages(files);

    // Set active draft
    setActiveDraftId(draftId);

    // Calculate and return the first incomplete step
    const firstIncomplete = computeFirstIncompleteStep(draft, images.length > 0);
    const targetTab = draftStepToWorkTab(firstIncomplete);
    store.setActiveTab(targetTab);

    return targetTab;
  }, []);

  /**
   * Sync current WorkFlowStore state to active draft
   */
  const syncToDraft = useCallback(
    async (draftId?: string) => {
      const targetDraftId = draftId || activeDraftId;
      if (!targetDraftId) return;

      const store = useWorkFlowStore.getState();

      await updateDraftMutation.mutateAsync({
        draftId: targetDraftId,
        data: {
          gardenAddress: store.gardenAddress,
          actionUID: store.actionUID,
          feedback: store.feedback,
          plantSelection: store.plantSelection,
          plantCount: store.plantCount,
          currentStep: workTabToDraftStep(store.activeTab),
        },
      });

      // Also sync images
      if (store.images.length > 0) {
        await setImagesMutation.mutateAsync({
          draftId: targetDraftId,
          files: store.images,
        });
      }
    },
    [activeDraftId, updateDraftMutation, setImagesMutation]
  );

  /**
   * Clear active draft on submission complete
   */
  const clearActiveDraft = useCallback(async () => {
    if (activeDraftId) {
      await deleteDraftMutation.mutateAsync(activeDraftId);
    }
  }, [activeDraftId, deleteDraftMutation]);

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
      thumbnailUrl: images[0]?.url || null,
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
    createOrGetDraft,
    resumeDraft,
    syncToDraft,
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
