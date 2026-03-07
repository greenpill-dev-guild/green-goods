import {
  categorizeError,
  DEFAULT_CHAIN_ID,
  formatHypercertMetadata,
  getSDGLabel,
  type HypercertAttestation,
  logger,
  prefillMetadataFromAssessment,
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
import { FormWizard } from "@/components/Form/FormWizard";
import type { Step } from "@/components/Form/StepIndicator";
import { LeaveConfirmDialog } from "@/components/hypercerts/LeaveConfirmDialog";
import { MintingDialog } from "@/components/hypercerts/MintingDialog";
import { RestoreDraftDialog } from "@/components/hypercerts/RestoreDraftDialog";
import { WizardStepContent } from "@/components/hypercerts/WizardStepContent";
import {
  getErrorMessageKey,
  type HypercertCompletionData,
} from "@/components/hypercerts/WizardTypes";

export type { HypercertCompletionData } from "@/components/hypercerts/WizardTypes";

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

  // --- Assessment prefill ---

  const selectedAssessment = useMemo(
    () => assessments?.find((a) => a.id === selectedAssessmentId) ?? null,
    [assessments, selectedAssessmentId]
  );

  const lastPrefillId = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedAssessment) return;
    if (lastPrefillId.current === selectedAssessment.id) return;
    lastPrefillId.current = selectedAssessment.id;

    const prefill = prefillMetadataFromAssessment(selectedAssessment, getSDGLabel);
    updateMetadata(prefill);
  }, [selectedAssessment, updateMetadata]);

  // --- Navigation guard ---

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const blockerRef = useRef<Blocker | null>(null);

  const hasUnsavedChanges = useMemo(() => {
    if (["pending", "confirmed"].includes(mintingState.status)) return false;
    return selectedAttestationIds.length > 0 || currentStep > 1;
  }, [selectedAttestationIds.length, currentStep, mintingState.status]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );

  useWindowEvent("beforeunload", (event) => {
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = "";
  });

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

  // --- Draft restoration ---

  const { peekDraft, loadDraft, clearDraft } = useHypercertDraft(gardenId, operatorAddress, {
    enabled: draftReady && Boolean(gardenId && operatorAddress),
    autoLoad: false,
  });

  const [showRestoreDraft, setShowRestoreDraft] = useState(false);

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

  // --- Attestation & data derivation ---

  const selectedAttestations = useMemo(() => {
    if (!attestations.length) return [] as HypercertAttestation[];
    return attestations.filter((attestation) => selectedAttestationIds.includes(attestation.id));
  }, [attestations, selectedAttestationIds]);

  const bundledAttestations = useMemo(() => {
    const mapping: Record<string, { hypercertId: string; title?: string | null }> = {};
    for (const hypercert of hypercerts) {
      const attestationUIDs = hypercert.attestationUIDs ?? [];
      for (const uid of attestationUIDs) {
        mapping[uid] = {
          hypercertId: hypercert.id,
          title: hypercert.title,
        };
      }
    }
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
    for (const attestation of selectedAttestations) {
      start = Math.min(start, attestation.createdAt || attestation.approvedAt);
      end = Math.max(end, attestation.approvedAt || attestation.createdAt);
    }
    return {
      start: Number.isFinite(start) ? start : null,
      end: Number.isFinite(end) ? end : null,
    };
  }, [selectedAttestations]);

  // --- Draft & preview ---

  // eslint-disable-next-line react-hooks/exhaustive-deps -- Store values intentionally trigger recalc even though not passed to toDraft
  const draft = useMemo(
    () => toDraft(gardenId, (operatorAddress ?? zeroAddress) as `0x${string}`),
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

  // --- Minting completion ---

  useEffect(() => {
    if (mintingState.status === "confirmed" && mintingState.hypercertId) {
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

  // --- Wizard steps & validation ---

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

  const validationMessage = useMemo(() => {
    if (!nextDisabled) return undefined;

    switch (currentStep) {
      case 1:
        return selectedAttestationIds.length === 0
          ? formatMessage({ id: "app.hypercerts.wizard.validation.selectAttestation" })
          : undefined;
      case 2: {
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
      case 3:
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

  const handleStepClick = useCallback(
    (stepIndex: number) => {
      const targetStep = stepIndex + 1;
      if (targetStep < currentStep) {
        setStep(targetStep);
      }
    },
    [currentStep, setStep]
  );

  // --- Render ---

  return (
    <>
      <LeaveConfirmDialog
        isOpen={showLeaveConfirm}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />
      <RestoreDraftDialog
        isOpen={showRestoreDraft}
        draftId={wizardDraftId}
        onClose={() => setShowRestoreDraft(false)}
        loadDraft={loadDraft}
        clearDraft={clearDraft}
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
        <WizardStepContent
          currentStep={currentStep}
          steps={steps}
          attestations={attestations}
          selectedAttestationIds={selectedAttestationIds}
          selectedAttestations={selectedAttestations}
          onToggleAttestation={toggleAttestation}
          isLoading={isLoading}
          hasError={hasError}
          bundledAttestations={bundledAttestations}
          assessments={assessments}
          selectedAssessmentId={selectedAssessmentId}
          onAssessmentChange={setSelectedAssessmentId}
          draft={draft}
          onUpdateMetadata={updateMetadata}
          suggestedScopes={suggestedScopes}
          suggestedTimeframe={suggestedTimeframe}
          selectedAssessment={selectedAssessment}
          distributionMode={distributionMode}
          allowlist={allowlist}
          onModeChange={setDistributionMode}
          onAllowlistChange={setAllowlist}
          previewMetadata={previewMetadata}
          gardenName={gardenName}
          gardenId={gardenId}
          mintingState={mintingState}
          chainId={chainId}
          onEditMetadata={() => setStep(2)}
          onEditDistribution={() => setStep(3)}
        />
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
