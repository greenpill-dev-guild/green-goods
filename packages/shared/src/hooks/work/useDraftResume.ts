/**
 * Draft Resume Hook
 *
 * Handles resuming drafts from URL parameters and detecting
 * meaningful drafts that should prompt the user to continue.
 *
 * @module hooks/work/useDraftResume
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { trackStorageError } from "../../modules/app/error-tracking";
import { useDrafts } from "./useDrafts";

interface DraftFormState {
  images: File[];
  gardenAddress: string | null;
  actionUID: number | null;
  feedback: string;
  plantSelection: string[];
  plantCount: number | null;
}

interface UseDraftResumeOptions {
  /** Current form state for detecting meaningful progress */
  formState: DraftFormState;
  /** Whether the user is on the intro tab */
  isOnIntroTab: boolean;
  /** URL search params for draftId parameter */
  searchParams: URLSearchParams;
  /** Function to update search params */
  setSearchParams: (params: URLSearchParams, options?: { replace?: boolean }) => void;
}

/**
 * Hook for handling draft resumption from URL and detecting meaningful drafts.
 *
 * @example
 * ```tsx
 * const [searchParams, setSearchParams] = useSearchParams();
 *
 * const {
 *   showDraftDialog,
 *   setShowDraftDialog,
 *   handleContinueDraft,
 *   handleStartFresh,
 * } = useDraftResume({
 *   formState: { images, gardenAddress, actionUID, feedback, plantSelection, plantCount },
 *   isOnIntroTab: activeTab === WorkTab.Intro,
 *   searchParams,
 *   setSearchParams,
 * });
 * ```
 */
export function useDraftResume(options: UseDraftResumeOptions) {
  const { formState, isOnIntroTab, searchParams, setSearchParams } = options;

  const { activeDraftId, resumeDraft, clearActiveDraft } = useDrafts();

  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const hasCheckedDraft = useRef(false);
  const hasResumedDraft = useRef(false);

  /**
   * Resume draft from URL parameter
   */
  useEffect(() => {
    if (hasResumedDraft.current) return;

    const draftIdFromUrl = searchParams.get("draftId");
    if (draftIdFromUrl) {
      hasResumedDraft.current = true;
      resumeDraft(draftIdFromUrl)
        .then(() => {
          // Clear draftId from URL after resuming
          const newParams = new URLSearchParams(searchParams);
          newParams.delete("draftId");
          setSearchParams(newParams, { replace: true });
        })
        .catch((error) => {
          console.error("[useDraftResume] Failed to resume draft:", error);
          trackStorageError(error, {
            source: "useDraftResume.resumeFromUrl",
            userAction: "resuming draft from URL parameter",
            recoverable: true,
            metadata: { draft_id: draftIdFromUrl, operation: "resume_draft" },
          });
          // Clear invalid draftId from URL
          const newParams = new URLSearchParams(searchParams);
          newParams.delete("draftId");
          setSearchParams(newParams, { replace: true });
        });
    }
  }, [searchParams, setSearchParams, resumeDraft]);

  /**
   * Check for meaningful draft progress to show dialog
   */
  useEffect(() => {
    if (hasCheckedDraft.current) return;
    hasCheckedDraft.current = true;

    // Don't show dialog if resuming a draft from URL
    const draftIdFromUrl = searchParams.get("draftId");
    if (draftIdFromUrl) return;

    // Images are the strongest indicator of draft progress
    const hasImages = formState.images.length > 0;

    // Having both selections + some form input indicates progress
    const hasBothSelections = formState.gardenAddress !== null && formState.actionUID !== null;
    const hasFormInput =
      formState.feedback.length > 0 ||
      formState.plantSelection.length > 0 ||
      (formState.plantCount ?? 0) > 0;
    const hasProgressWithSelections = hasBothSelections && hasFormInput;

    const hasMeaningfulDraft = hasImages || hasProgressWithSelections;

    if (hasMeaningfulDraft && isOnIntroTab) {
      setShowDraftDialog(true);
    }
  }, [formState, isOnIntroTab, searchParams]);

  /**
   * Continue with the existing draft
   */
  const handleContinueDraft = useCallback(() => {
    setShowDraftDialog(false);
    // Draft is already loaded, just continue
  }, []);

  /**
   * Start fresh by clearing the draft
   */
  const handleStartFresh = useCallback(async () => {
    setShowDraftDialog(false);
    if (activeDraftId) {
      try {
        await clearActiveDraft();
      } catch (error) {
        console.error("[useDraftResume] Failed to clear draft:", error);
        trackStorageError(error, {
          source: "useDraftResume.handleStartFresh",
          userAction: "clearing active draft to start fresh",
          recoverable: true,
          metadata: { draft_id: activeDraftId, operation: "clear_draft" },
        });
      }
    }
  }, [activeDraftId, clearActiveDraft]);

  return {
    /** Whether to show the draft continuation dialog */
    showDraftDialog,
    /** Set dialog visibility */
    setShowDraftDialog,
    /** Handler for continuing with draft */
    handleContinueDraft,
    /** Handler for starting fresh */
    handleStartFresh,
    /** Whether a draft is currently being resumed from URL */
    isResumingFromUrl: hasResumedDraft.current,
    /** Clear the active draft (e.g., after successful submission) */
    clearActiveDraft,
  };
}
