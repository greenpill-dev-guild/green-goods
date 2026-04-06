import {
  categorizeError,
  DEFAULT_CHAIN_ID,
  formatHypercertMetadata,
  getSDGLabel,
  type HypercertAttestation,
  logger,
  prefillMetadataFromAssessment,
  TOTAL_UNITS,
  toastService,
  useAdminStore,
  useAuth,
  useCreateHypercertWorkflow,
  useGardenAssessments,
  useHypercertAllowlist,
  useHypercertAttestations,
  useHypercertContributorWeights,
  useHypercertDraft,
  useHypercerts,
  useHypercertWizardStore,
  useMintHypercert,
  useWindowEvent,
} from "@green-goods/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { type Blocker, useBlocker } from "react-router-dom";
import { zeroAddress } from "viem";
import { getErrorMessageKey, type HypercertCompletionData } from "./types";
import { useValidationMessage, useWizardSteps } from "./wizardSteps";

interface UseWizardDataOptions {
  gardenId: string;
  gardenName: string;
  onComplete: (data: HypercertCompletionData) => void;
}

export function useWizardData({ gardenId, gardenName, onComplete }: UseWizardDataOptions) {
  const { formatMessage } = useIntl();
  const { smartAccountAddress, eoaAddress } = useAuth();
  const operatorAddress = smartAccountAddress ?? eoaAddress ?? undefined;
  const [draftReady, setDraftReady] = useState(false);
  const chainId = useAdminStore((state) => state.selectedChainId) ?? DEFAULT_CHAIN_ID;

  // Granular selectors to prevent unnecessary re-renders (Rule 6)
  const selectedAttestationIds = useHypercertWizardStore((s) => s.selectedAttestationIds);
  const distributionMode = useHypercertWizardStore((s) => s.distributionMode);
  const allowlist = useHypercertWizardStore((s) => s.allowlist);
  const mintingState = useHypercertWizardStore((s) => s.mintingState);
  const reset = useHypercertWizardStore((s) => s.reset);
  const toggleAttestation = useHypercertWizardStore((s) => s.toggleAttestation);
  const setSelectedAttestations = useHypercertWizardStore((s) => s.setSelectedAttestations);
  const updateMetadata = useHypercertWizardStore((s) => s.updateMetadata);
  const setAllowlist = useHypercertWizardStore((s) => s.setAllowlist);
  const setDistributionMode = useHypercertWizardStore((s) => s.setDistributionMode);
  const toDraft = useHypercertWizardStore((s) => s.toDraft);
  // Metadata fields for dependency tracking
  const wizardTitle = useHypercertWizardStore((s) => s.title);
  const wizardDescription = useHypercertWizardStore((s) => s.description);
  const wizardWorkScopes = useHypercertWizardStore((s) => s.workScopes);
  const wizardWorkTimeframeStart = useHypercertWizardStore((s) => s.workTimeframeStart);
  const wizardWorkTimeframeEnd = useHypercertWizardStore((s) => s.workTimeframeEnd);
  const wizardDraftId = useHypercertWizardStore((s) => s.draftId);

  const { currentStep, nextStep, previousStep, setStep, canProceed } = useCreateHypercertWorkflow();

  const { attestations, isLoading, hasError } = useHypercertAttestations(gardenId);
  const { data: assessments } = useGardenAssessments(gardenId);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const { hypercerts } = useHypercerts({ gardenId });
  const { mint, retry, cancel } = useMintHypercert({ errorMode: "inline" });

  // Resolve the selected assessment object for prefill
  const selectedAssessment = useMemo(
    () => assessments?.find((a) => a.id === selectedAssessmentId) ?? null,
    [assessments, selectedAssessmentId]
  );

  // Prefill metadata when an assessment is selected (one-time apply)
  const lastPrefillId = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedAssessment) return;
    // Only prefill once per assessment selection (don't re-apply on re-renders)
    if (lastPrefillId.current === selectedAssessment.id) return;
    lastPrefillId.current = selectedAssessment.id;

    const prefill = prefillMetadataFromAssessment(selectedAssessment, getSDGLabel);
    updateMetadata(prefill);
  }, [selectedAssessment, updateMetadata]);

  // State for confirm dialog when blocking navigation
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const blockerRef = useRef<Blocker | null>(null);

  // Track if user has made changes worth protecting
  const hasUnsavedChanges = useMemo(() => {
    // Don't block if minting is in progress or completed
    if (["pending", "confirmed"].includes(mintingState.status)) return false;
    // Block if user has selected attestations or moved past step 1
    return selectedAttestationIds.length > 0 || currentStep > 1;
  }, [selectedAttestationIds.length, currentStep, mintingState.status]);

  // Block React Router navigation when there are unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );

  // Handle browser refresh/close with beforeunload
  useWindowEvent("beforeunload", (event) => {
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    // Modern browsers ignore custom messages, but this triggers the dialog
    event.returnValue = "";
  });

  // Handle blocker state - show confirmation dialog
  useEffect(() => {
    if (blocker.state === "blocked") {
      blockerRef.current = blocker;
      setShowLeaveConfirm(true);
    }
  }, [blocker]);

  const handleConfirmLeave = useCallback(() => {
    reset();
    blockerRef.current?.proceed();
    setShowLeaveConfirm(false);
    blockerRef.current = null;
  }, [reset]);

  const handleCancelLeave = useCallback(() => {
    blockerRef.current?.reset();
    setShowLeaveConfirm(false);
    blockerRef.current = null;
  }, []);

  const { peekDraft, loadDraft, clearDraft } = useHypercertDraft(gardenId, operatorAddress, {
    enabled: draftReady && Boolean(gardenId && operatorAddress),
    autoLoad: false,
  });

  const [showRestoreDraft, setShowRestoreDraft] = useState(false);
  const [restoreDraftPending, setRestoreDraftPending] = useState(false);

  useEffect(() => {
    reset();
    setDraftReady(true);
  }, [gardenId, reset]);

  useEffect(() => {
    let isActive = true;
    if (!draftReady || !gardenId || !operatorAddress) return;

    const checkDraft = async () => {
      const stored = await peekDraft();
      if (!isActive || !stored) return;
      setShowRestoreDraft(true);
    };

    void checkDraft();
    return () => {
      isActive = false;
    };
  }, [draftReady, gardenId, operatorAddress, peekDraft]);

  const selectedAttestations = useMemo(() => {
    if (!attestations.length) return [] as HypercertAttestation[];
    return attestations.filter((attestation) => selectedAttestationIds.includes(attestation.id));
  }, [attestations, selectedAttestationIds]);

  const bundledAttestations = useMemo(() => {
    const mapping: Record<string, { hypercertId: string; title?: string | null }> = {};
    hypercerts.forEach((hypercert) => {
      const attestationUIDs = hypercert.attestationUIDs ?? [];
      attestationUIDs.forEach((uid) => {
        mapping[uid] = {
          hypercertId: hypercert.id,
          title: hypercert.title,
        };
      });
    });
    return mapping;
  }, [hypercerts]);

  useEffect(() => {
    if (!selectedAttestationIds.length) return;
    const pruned = selectedAttestationIds.filter((id) => !bundledAttestations[id]);
    if (pruned.length !== selectedAttestationIds.length) {
      setSelectedAttestations(pruned);
    }
  }, [bundledAttestations, selectedAttestationIds, setSelectedAttestations]);

  const contributorWeights = useHypercertContributorWeights(selectedAttestations);

  useHypercertAllowlist({
    allowlist,
    contributorWeights,
    distributionMode,
    hasSelectedAttestations: selectedAttestations.length > 0,
    onAllowlistChange: setAllowlist,
  });

  const suggestedScopes = useMemo(() => {
    const scopes = selectedAttestations.flatMap((attestation) => attestation.workScope ?? []);
    return Array.from(new Set(scopes));
  }, [selectedAttestations]);

  const suggestedTimeframe = useMemo(() => {
    if (!selectedAttestations.length) return { start: null, end: null };
    let start = Number.POSITIVE_INFINITY;
    let end = Number.NEGATIVE_INFINITY;
    selectedAttestations.forEach((attestation) => {
      start = Math.min(start, attestation.createdAt || attestation.approvedAt);
      end = Math.max(end, attestation.approvedAt || attestation.createdAt);
    });
    return {
      start: Number.isFinite(start) ? start : null,
      end: Number.isFinite(end) ? end : null,
    };
  }, [selectedAttestations]);

  // Include metadata fields to ensure draft recalculates when form values change
  // This is necessary because toDraft reads from store state via get()
  const draft = useMemo(
    () => toDraft(gardenId, (operatorAddress ?? zeroAddress) as `0x${string}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Store values intentionally trigger recalc even though not passed to toDraft
    [
      gardenId,
      operatorAddress,
      toDraft,
      wizardTitle,
      wizardDescription,
      wizardWorkScopes,
      wizardWorkTimeframeStart,
      wizardWorkTimeframeEnd,
      selectedAttestationIds,
      allowlist,
      distributionMode,
    ]
  );

  const previewMetadata = useMemo(() => {
    if (!selectedAttestations.length) return null;
    return formatHypercertMetadata({
      draft,
      attestations: selectedAttestations,
      allowlist,
      gardenName,
    });
  }, [allowlist, draft, gardenName, selectedAttestations]);

  useEffect(() => {
    if (mintingState.status === "confirmed" && mintingState.hypercertId) {
      // Pass optimistic data for immediate UI rendering while indexer syncs
      onComplete({
        hypercertId: mintingState.hypercertId,
        title: wizardTitle || "",
        description: wizardDescription || "",
        workScopes: wizardWorkScopes || [],
        imageUri: previewMetadata?.image,
        attestationCount: selectedAttestations.length,
        mintedAt: Math.floor(Date.now() / 1000),
        txHash: mintingState.txHash ?? undefined,
      });
    }
  }, [
    mintingState.hypercertId,
    mintingState.status,
    mintingState.txHash,
    onComplete,
    previewMetadata?.image,
    selectedAttestations.length,
    wizardDescription,
    wizardTitle,
    wizardWorkScopes,
  ]);

  const handleMint = useCallback(async () => {
    if (!gardenId) return;
    if (!operatorAddress) {
      toastService.error({
        title: formatMessage({ id: "app.hypercerts.mint.error.auth.title" }),
        message: formatMessage({ id: "app.hypercerts.mint.error.auth.message" }),
        context: "hypercert minting",
        suppressLogging: true,
      });
      return;
    }

    if (mintingState.status === "failed") {
      retry();
      return;
    }

    if (!previewMetadata) {
      toastService.error({
        title: formatMessage({ id: "app.hypercerts.mint.error.metadata.title" }),
        message: formatMessage({ id: "app.hypercerts.mint.error.metadata.message" }),
        context: "hypercert minting",
        suppressLogging: true,
      });
      return;
    }

    try {
      await mint({
        draft,
        attestations: selectedAttestations,
        allowlist,
        metadata: previewMetadata,
      });
    } catch (error) {
      const categorized = categorizeError(error);
      logger.error("[HypercertWizard] Failed to mint hypercert", {
        message: categorized.message,
        category: categorized.category,
        metadata: categorized.metadata,
      });
      toastService.error({
        title: formatMessage({ id: "app.hypercerts.mint.error.generic.title" }),
        message: formatMessage({ id: getErrorMessageKey(categorized) }),
        context: "hypercert minting",
        suppressLogging: true,
      });
    }
  }, [
    allowlist,
    draft,
    formatMessage,
    gardenId,
    mint,
    mintingState.status,
    operatorAddress,
    previewMetadata,
    retry,
    selectedAttestations,
  ]);

  const steps = useWizardSteps(formatMessage);

  const isSubmitting = [
    "uploading_metadata",
    "uploading_allowlist",
    "building_userop",
    "pending",
  ].includes(mintingState.status);

  const nextDisabled = !canProceed(currentStep);
  const submitLabel =
    mintingState.status === "failed"
      ? formatMessage({ id: "app.hypercerts.mint.retry" })
      : formatMessage({ id: "app.hypercerts.mint.submit" });

  const validationMessage = useValidationMessage({
    currentStep,
    nextDisabled,
    selectedAttestationIds,
    wizardTitle,
    wizardWorkScopes,
    wizardWorkTimeframeStart,
    wizardWorkTimeframeEnd,
    formatMessage,
  });

  // Handle clicking on completed steps in the step indicator
  // stepIndex is 0-based (from FormWizard), workflow uses 1-based steps
  const handleStepClick = useCallback(
    (stepIndex: number) => {
      const targetStep = stepIndex + 1;
      // Only allow navigating to completed steps (before current)
      if (targetStep < currentStep) {
        setStep(targetStep);
      }
    },
    [currentStep, setStep]
  );

  // Handle step component errors - show toast and log
  const handleStepError = useCallback(
    (error: Error) => {
      const stepName = steps[currentStep - 1]?.id ?? "unknown";
      toastService.error({
        title: formatMessage({ id: "app.hypercerts.wizard.error.title" }),
        message: formatMessage({ id: "app.hypercerts.wizard.error.message" }),
        context: `HypercertWizard step ${stepName}`,
        suppressLogging: true, // Already logged by ErrorBoundary
      });
      logger.error(`[HypercertWizard] Step ${stepName} crashed`, {
        message: error.message,
        stack: error.stack,
      });
    },
    [currentStep, formatMessage, steps]
  );

  return {
    // Workflow navigation
    currentStep,
    nextStep,
    previousStep,
    setStep,
    steps,
    handleStepClick,
    handleStepError,
    handleMint,

    // Attestation data
    attestations,
    isLoading,
    hasError,
    selectedAttestationIds,
    selectedAttestations,
    toggleAttestation,
    bundledAttestations,

    // Assessment data
    assessments,
    selectedAssessmentId,
    setSelectedAssessmentId,
    selectedAssessment,

    // Metadata and draft
    draft,
    updateMetadata,
    suggestedScopes,
    suggestedTimeframe,
    previewMetadata,

    // Distribution
    distributionMode,
    allowlist,
    setDistributionMode,
    setAllowlist,

    // Minting state
    mintingState,
    chainId,
    cancel,
    retry,
    isSubmitting,
    nextDisabled,
    submitLabel,
    validationMessage,

    // Navigation guards
    showLeaveConfirm,
    handleConfirmLeave,
    handleCancelLeave,

    // Draft restore
    showRestoreDraft,
    setShowRestoreDraft,
    restoreDraftPending,
    setRestoreDraftPending,
    loadDraft,
    clearDraft,
    wizardDraftId,
    reset,
  };
}
