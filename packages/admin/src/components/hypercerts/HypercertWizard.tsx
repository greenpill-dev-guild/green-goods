import {
  categorizeError,
  ConfirmDialog,
  DEFAULT_CHAIN_ID,
  ErrorBoundary,
  logger,
  TOTAL_UNITS,
  buildContributorWeights,
  calculateDistribution,
  formatHypercertMetadata,
  getSDGLabel,
  prefillMetadataFromAssessment,
  toastService,
  useAdminStore,
  useHypercertAttestations,
  useAuth,
  useCreateHypercertWorkflow,
  useHypercertDraft,
  useHypercerts,
  useMintHypercert,
  useGardenAssessments,
  useHypercertWizardStore,
  type HypercertAttestation,
  type CategorizedError,
  type ErrorCategory,
} from "@green-goods/shared";
import { zeroAddress } from "viem";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useIntl } from "react-intl";
import { useBlocker, type Blocker } from "react-router-dom";
import { FormWizard } from "@/components/Form/FormWizard";
import type { Step } from "@/components/Form/StepIndicator";
import { AttestationSelector } from "@/components/hypercerts/steps/AttestationSelector";
import { DistributionConfig } from "@/components/hypercerts/steps/DistributionConfig";
import { HypercertPreview } from "@/components/hypercerts/steps/HypercertPreview";
import { MetadataEditor } from "@/components/hypercerts/steps/MetadataEditor";
import { MintingDialog } from "@/components/hypercerts/MintingDialog";

/** Maps error categories to i18n message keys for user-facing error display */
const ERROR_CATEGORY_KEYS: Record<ErrorCategory, string> = {
  network: "app.errors.network",
  blockchain: "app.errors.blockchain",
  auth: "app.errors.auth",
  validation: "app.errors.validation",
  permission: "app.errors.permission",
  storage: "app.errors.storage",
  unknown: "app.hypercerts.mint.error.generic.message",
};

/** Get the i18n message key for a categorized error */
function getErrorMessageKey(categorized: CategorizedError): string {
  return ERROR_CATEGORY_KEYS[categorized.category];
}

/**
 * Data passed to onComplete for optimistic UI rendering.
 * Allows the detail page to show content immediately while indexer syncs.
 */
export interface HypercertCompletionData {
  hypercertId: string;
  title: string;
  description: string;
  workScopes: string[];
  imageUri?: string;
  attestationCount: number;
  mintedAt: number;
  txHash?: `0x${string}`;
}

interface HypercertWizardProps {
  gardenId: string;
  gardenName: string;
  onComplete: (data: HypercertCompletionData) => void;
  onCancel: () => void;
}

export function HypercertWizard({
  gardenId,
  gardenName,
  onComplete,
  onCancel,
}: HypercertWizardProps) {
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
  const { mint, retry, cancel } = useMintHypercert();

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
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Modern browsers ignore custom messages, but this triggers the dialog
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

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

  const contributorWeights = useMemo(
    () => buildContributorWeights(selectedAttestations),
    [selectedAttestations]
  );

  useEffect(() => {
    if (!selectedAttestations.length) return;
    if (distributionMode === "custom" && allowlist.length > 0) return;

    const mode = distributionMode === "proportional" ? "count" : distributionMode;
    const nextAllowlist = calculateDistribution(contributorWeights, mode, allowlist);

    // Deep compare to avoid infinite loop - only update if contents differ
    const isDifferent =
      nextAllowlist.length !== allowlist.length ||
      nextAllowlist.some(
        (entry, i) => entry.address !== allowlist[i]?.address || entry.units !== allowlist[i]?.units
      );

    if (isDifferent) {
      setAllowlist(nextAllowlist);
    }
  }, [allowlist, contributorWeights, distributionMode, selectedAttestations, setAllowlist]);

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

  // 4-step wizard: attestations, metadata, distribution, preview+mint
  const steps: Step[] = useMemo(
    () => [
      {
        id: "attestations",
        title: formatMessage({ id: "app.hypercerts.wizard.step.attestations.title" }),
        description: formatMessage({
          id: "app.hypercerts.wizard.step.attestations.description",
        }),
      },
      {
        id: "metadata",
        title: formatMessage({ id: "app.hypercerts.wizard.step.metadata.title" }),
        description: formatMessage({ id: "app.hypercerts.wizard.step.metadata.description" }),
      },
      {
        id: "distribution",
        title: formatMessage({ id: "app.hypercerts.wizard.step.distribution.title" }),
        description: formatMessage({ id: "app.hypercerts.wizard.step.distribution.description" }),
      },
      {
        id: "preview",
        title: formatMessage({ id: "app.hypercerts.wizard.step.preview.title" }),
        description: formatMessage({ id: "app.hypercerts.wizard.step.preview.description" }),
      },
    ],
    [formatMessage]
  );

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

  // Generate validation message based on current step (4-step wizard)
  const validationMessage = useMemo(() => {
    if (!nextDisabled) return undefined;

    switch (currentStep) {
      case 1: // Attestation selection
        return selectedAttestationIds.length === 0
          ? formatMessage({ id: "app.hypercerts.wizard.validation.selectAttestation" })
          : undefined;
      case 2: {
        // Metadata - check all required fields
        const missingFields: string[] = [];
        if (!wizardTitle?.trim()) {
          missingFields.push(formatMessage({ id: "app.hypercerts.metadata.title" }));
        }
        if (!wizardWorkScopes?.length) {
          missingFields.push(formatMessage({ id: "app.hypercerts.metadata.workScope" }));
        }
        if (!wizardWorkTimeframeStart) {
          missingFields.push(formatMessage({ id: "app.hypercerts.metadata.workTimeframeStart" }));
        }
        if (!wizardWorkTimeframeEnd) {
          missingFields.push(formatMessage({ id: "app.hypercerts.metadata.workTimeframeEnd" }));
        }
        if (missingFields.length > 0) {
          return formatMessage(
            { id: "app.hypercerts.wizard.validation.missingFields" },
            { fields: missingFields.join(", ") }
          );
        }
        return undefined;
      }
      case 3: // Distribution - validation handled by canProceed via allowlistValidation
        return formatMessage({ id: "app.hypercerts.wizard.validation.distribution" });
      default:
        return undefined;
    }
  }, [
    currentStep,
    nextDisabled,
    selectedAttestationIds.length,
    wizardTitle,
    wizardWorkScopes,
    wizardWorkTimeframeStart,
    wizardWorkTimeframeEnd,
    formatMessage,
  ]);

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

  return (
    <>
      <ConfirmDialog
        isOpen={showLeaveConfirm}
        onClose={handleCancelLeave}
        onConfirm={handleConfirmLeave}
        title={formatMessage({ id: "app.hypercerts.wizard.leaveConfirm.title" })}
        description={formatMessage({ id: "app.hypercerts.wizard.unsavedChanges" })}
        confirmLabel={formatMessage({ id: "app.hypercerts.wizard.leaveConfirm.confirm" })}
        cancelLabel={formatMessage({ id: "app.hypercerts.wizard.leaveConfirm.cancel" })}
        variant="warning"
      />
      <ConfirmDialog
        isOpen={showRestoreDraft}
        onClose={() => setShowRestoreDraft(false)}
        onConfirm={async () => {
          setRestoreDraftPending(true);
          await loadDraft();
          setRestoreDraftPending(false);
          setShowRestoreDraft(false);
        }}
        onError={() => {
          setRestoreDraftPending(false);
          setShowRestoreDraft(false);
        }}
        title={formatMessage({ id: "app.hypercerts.wizard.restore.title" })}
        description={formatMessage({ id: "app.hypercerts.wizard.restore.description" })}
        confirmLabel={formatMessage({ id: "app.hypercerts.wizard.restore.confirm" })}
        cancelLabel={formatMessage({ id: "app.hypercerts.wizard.restore.cancel" })}
        onCancel={async () => {
          try {
            await clearDraft();
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error("[HypercertWizard] Failed to clear draft on cancel", {
              error: err.message,
              stack: err.stack,
              draftId: wizardDraftId,
            });
            // Inform user but don't block dialog close
            toastService.show({
              status: "info",
              message: formatMessage({ id: "app.hypercerts.wizard.draft.clear.failed" }),
              duration: 3000,
            });
          }
          setShowRestoreDraft(false);
        }}
        variant="warning"
        isLoading={restoreDraftPending}
      />
      <FormWizard
        steps={steps}
        currentStep={currentStep - 1}
        onNext={nextStep}
        onBack={previousStep}
        onCancel={onCancel}
        onSubmit={handleMint}
        onStepClick={handleStepClick}
        nextDisabled={nextDisabled}
        validationMessage={validationMessage}
        isSubmitting={isSubmitting}
        nextLabel={formatMessage({ id: "app.hypercerts.wizard.next" })}
        submitLabel={submitLabel}
      >
        <ErrorBoundary context={`HypercertWizard.Step${currentStep}`} onError={handleStepError}>
          {currentStep === 1 && (
            <AttestationSelector
              attestations={attestations}
              selectedIds={selectedAttestationIds}
              onToggle={toggleAttestation}
              isLoading={isLoading}
              hasError={hasError}
              bundledInfo={bundledAttestations}
              assessments={assessments}
              selectedAssessmentId={selectedAssessmentId}
              onAssessmentChange={setSelectedAssessmentId}
            />
          )}

          {currentStep === 2 && (
            <MetadataEditor
              draft={draft}
              onUpdate={(updates) => updateMetadata(updates)}
              suggestedWorkScopes={suggestedScopes}
              suggestedStart={suggestedTimeframe.start}
              suggestedEnd={suggestedTimeframe.end}
              selectedAssessment={selectedAssessment}
            />
          )}

          {currentStep === 3 && (
            <DistributionConfig
              mode={distributionMode}
              allowlist={allowlist}
              totalUnits={TOTAL_UNITS}
              onModeChange={setDistributionMode}
              onAllowlistChange={setAllowlist}
            />
          )}

          {currentStep === 4 && (
            <HypercertPreview
              metadata={previewMetadata}
              gardenName={gardenName}
              gardenId={gardenId}
              attestationCount={selectedAttestations.length}
              totalUnits={TOTAL_UNITS}
              allowlist={allowlist}
              mintingState={mintingState}
              chainId={chainId}
              selectedAssessment={selectedAssessment}
              onEditMetadata={() => setStep(2)}
              onEditDistribution={() => setStep(3)}
            />
          )}
        </ErrorBoundary>
      </FormWizard>
      <MintingDialog
        mintingState={mintingState}
        chainId={chainId}
        onCancel={cancel}
        onRetry={retry}
      />
    </>
  );
}
