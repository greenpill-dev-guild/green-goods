import { Alert } from "@green-goods/shared/components/Alert";
import { ErrorBoundary } from "@green-goods/shared/components/ErrorBoundary/ErrorBoundary";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import type {
  HypercertCompletionData,
  HypercertWizardProps,
} from "@green-goods/shared/hooks/admin-ui/hypercerts/types";
import { useWizardData } from "@green-goods/shared/hooks/admin-ui/hypercerts/useWizardData";
import { useStepFocus } from "@green-goods/shared/hooks/utils/useStepFocus";
import { useTxErrorMessages } from "@green-goods/shared/hooks/utils/useTxErrorMessages";
import { TOTAL_UNITS } from "@green-goods/shared/lib/hypercerts/constants";
import { logger } from "@green-goods/shared/modules/app/logger";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";
import { AttestationSelector } from "@/components/Hypercerts/Steps/AttestationSelector";
import { DistributionConfig } from "@/components/Hypercerts/Steps/DistributionConfig";
import { HypercertPreview } from "@/components/Hypercerts/Steps/HypercertPreview";
import { MetadataEditor } from "@/components/Hypercerts/Steps/MetadataEditor";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { FlowSendFooter, flowSendPhase } from "@/components/Layout/FlowSendFooter";
import { FlowStatusRow } from "@/components/Layout/FlowStatusRow";
import { FlowStepHeader } from "@/components/Layout/FlowStepHeader";
import { hypercertSendStatus } from "./reviewStatus";

export type { HypercertCompletionData };
export type { HypercertWizardProps };

export function HypercertWizard({
  gardenId,
  gardenName,
  onComplete,
  onCancel,
  onDone,
}: HypercertWizardProps) {
  const { formatMessage } = useIntl();

  const wizard = useWizardData({ gardenId, gardenName, onComplete });
  const stepRef = useStepFocus<HTMLDivElement>(wizard.currentStep);
  const mintFailed = wizard.mintingState.status === "failed";
  const txError = useTxErrorMessages(mintFailed ? wizard.mintingState.error : null);
  // One reading of the mint, so the status row and the footer never disagree.
  // The flow ends on its Review (DL-080): the mint shows there, in place, and
  // a confirmed mint leaves Done.
  const status = hypercertSendStatus({
    phase: flowSendPhase({
      sending: wizard.isSubmitting,
      sent: wizard.mintingState.status === "confirmed",
      failed: mintFailed,
    }),
    stage: wizard.mintingState.status,
    failure: {
      tone: txError.view.severity,
      title: txError.title,
      description: txError.message,
    },
    formatMessage,
  });
  const { phase } = status;
  // While it mints, and once it is minted, no step reopens: the way on is Done.
  const editable = phase === "ready" || phase === "failed";
  // Step 1 explains itself only after Next is pressed with no work selected,
  // so the steward is not warned before doing anything.
  const [nextTriedEmpty, setNextTriedEmpty] = useState(false);
  // The gate and its message read the same resolved selection, so saved picks
  // that match no loaded attestation still explain why Next did not advance.
  const needsAttestation = wizard.currentStep === 1 && wizard.selectedAttestations.length === 0;
  // Nothing to pick while attestations load or failed to load, so Next waits.
  // A failed refresh that keeps the loaded attestations leaves them usable.
  const attestationsUnavailable =
    wizard.currentStep === 1 &&
    wizard.attestations.length === 0 &&
    (wizard.isLoading || wizard.hasError);
  const validationMessage =
    nextTriedEmpty && needsAttestation
      ? formatMessage({ id: "app.hypercerts.wizard.validation.selectAttestation" })
      : undefined;
  const handleNext = () => {
    if (needsAttestation) {
      setNextTriedEmpty(true);
      return;
    }
    wizard.nextStep();
  };
  const isLastStep = wizard.currentStep === wizard.steps.length;
  const activeStep = wizard.steps[wizard.currentStep - 1];

  const sectionContent = {
    attestations: (
      <ErrorBoundary context="HypercertWizard.attestations" onError={wizard.handleStepError}>
        <AttestationSelector
          attestations={wizard.attestations}
          selectedIds={wizard.selectedAttestationIds}
          onToggle={wizard.toggleAttestation}
          isLoading={wizard.isLoading}
          hasError={wizard.hasError}
          bundledInfo={wizard.bundledAttestations}
          assessments={wizard.assessments}
          selectedAssessmentId={wizard.selectedAssessmentId}
          onAssessmentChange={wizard.setSelectedAssessmentId}
        />
      </ErrorBoundary>
    ),
    metadata: (
      <ErrorBoundary context="HypercertWizard.metadata" onError={wizard.handleStepError}>
        <MetadataEditor
          draft={wizard.draft}
          onUpdate={(updates) => wizard.updateMetadata(updates)}
          suggestedWorkScopes={wizard.suggestedScopes}
          suggestedStart={wizard.suggestedTimeframe.start}
          suggestedEnd={wizard.suggestedTimeframe.end}
          selectedAssessment={wizard.selectedAssessment}
        />
      </ErrorBoundary>
    ),
    distribution: (
      <ErrorBoundary context="HypercertWizard.distribution" onError={wizard.handleStepError}>
        <DistributionConfig
          mode={wizard.distributionMode}
          allowlist={wizard.allowlist}
          totalUnits={TOTAL_UNITS}
          onModeChange={wizard.setDistributionMode}
          onAllowlistChange={wizard.setAllowlist}
        />
      </ErrorBoundary>
    ),
    preview: (
      <ErrorBoundary context="HypercertWizard.preview" onError={wizard.handleStepError}>
        <div className="space-y-4">
          <FlowStatusRow
            tone={status.tone}
            busy={status.busy}
            title={status.title}
            description={status.description}
          />
          <HypercertPreview
            metadata={wizard.previewMetadata}
            gardenName={gardenName}
            gardenId={gardenId}
            attestationCount={wizard.selectedAttestations.length}
            totalUnits={TOTAL_UNITS}
            allowlist={wizard.allowlist}
            mintingState={wizard.mintingState}
            chainId={wizard.chainId}
            selectedAssessment={wizard.selectedAssessment}
            onEditMetadata={editable ? () => wizard.setStep(2) : undefined}
            onEditDistribution={editable ? () => wizard.setStep(3) : undefined}
          />
        </div>
      </ErrorBoundary>
    ),
  };

  return (
    <>
      <DiscardChangesDialog
        open={wizard.showLeaveConfirm}
        onKeepEditing={wizard.handleCancelLeave}
        onDiscard={wizard.handleConfirmLeave}
        tone="hub"
      />
      <AdminConfirmDialog
        isOpen={wizard.showRestoreDraft}
        onClose={() => wizard.setShowRestoreDraft(false)}
        onConfirm={async () => {
          wizard.setRestoreDraftPending(true);
          await wizard.loadDraft();
          wizard.setRestoreDraftPending(false);
          wizard.setShowRestoreDraft(false);
        }}
        onError={() => {
          wizard.setRestoreDraftPending(false);
          wizard.setShowRestoreDraft(false);
        }}
        title={formatMessage({ id: "app.hypercerts.wizard.restore.title" })}
        description={formatMessage({ id: "app.hypercerts.wizard.restore.description" })}
        confirmLabel={formatMessage({ id: "app.hypercerts.wizard.restore.confirm" })}
        cancelLabel={formatMessage({ id: "app.hypercerts.wizard.restore.cancel" })}
        tone="hub"
        onCancel={async () => {
          try {
            await wizard.clearDraft();
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error("[HypercertWizard] Failed to clear draft on cancel", {
              error: err.message,
              stack: err.stack,
              draftId: wizard.wizardDraftId,
            });
            // Inform user but don't block dialog close
            toastService.show({
              status: "info",
              message: formatMessage({ id: "app.hypercerts.wizard.draft.clear.failed" }),
              duration: 3000,
            });
          }
          wizard.setShowRestoreDraft(false);
        }}
        variant="warning"
        isLoading={wizard.restoreDraftPending}
      />
      <ActionFlowShell
        layout="dialog"
        title={formatMessage({ id: "app.hypercerts.create.title" })}
        context={gardenName}
        steps={wizard.steps}
        currentStep={wizard.currentStep}
        complete={phase === "sent"}
        onStepClick={editable ? (step) => wizard.handleStepClick(step - 1) : undefined}
        footer={
          <FlowSendFooter
            stepIndex={wizard.currentStep - 1}
            isLast={isLastStep}
            phase={phase}
            sendLabel={formatMessage({ id: "app.hypercerts.mint.submit" })}
            // Minting can ask the wallet twice (the mint, then the signal pool),
            // so the note only says the dialog waits while it works.
            note={
              phase === "sending"
                ? formatMessage({
                    id: "app.admin.flow.send.waiting",
                    defaultMessage: "The dialog stays open until your wallet answers.",
                  })
                : undefined
            }
            sendDisabled={wizard.selectedAttestations.length === 0}
            nextDisabled={(wizard.nextDisabled && !needsAttestation) || attestationsUnavailable}
            onCancel={onCancel}
            onBack={wizard.previousStep}
            onNext={handleNext}
            onSend={wizard.handleMint}
            onDone={onDone}
          />
        }
      >
        {activeStep ? (
          <div
            ref={stepRef}
            tabIndex={-1}
            data-region={`hypercert-step-${activeStep.id}`}
            className="space-y-4 outline-none"
          >
            <FlowStepHeader title={activeStep.title} description={activeStep.description} />
            {validationMessage ? <Alert variant="warning">{validationMessage}</Alert> : null}
            {sectionContent[activeStep.id as keyof typeof sectionContent]}
          </div>
        ) : null}
      </ActionFlowShell>
    </>
  );
}
