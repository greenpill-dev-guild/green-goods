import {
  ConfirmDialog,
  ErrorBoundary,
  FormWizard,
  logger,
  TOTAL_UNITS,
  toastService,
} from "@green-goods/shared";
import { useIntl } from "react-intl";
import { MintingDialog } from "@/components/Hypercerts/MintingDialog";
import { AttestationSelector } from "@/components/Hypercerts/Steps/AttestationSelector";
import { DistributionConfig } from "@/components/Hypercerts/Steps/DistributionConfig";
import { HypercertPreview } from "@/components/Hypercerts/Steps/HypercertPreview";
import { MetadataEditor } from "@/components/Hypercerts/Steps/MetadataEditor";
import type { HypercertCompletionData, HypercertWizardProps } from "./types";
import { useWizardData } from "./useWizardData";

export type { HypercertCompletionData };
export type { HypercertWizardProps };

export function HypercertWizard({
  gardenId,
  gardenName,
  onComplete,
  onCancel,
}: HypercertWizardProps) {
  const { formatMessage } = useIntl();

  const wizard = useWizardData({ gardenId, gardenName, onComplete });

  return (
    <>
      <ConfirmDialog
        isOpen={wizard.showLeaveConfirm}
        onClose={wizard.handleCancelLeave}
        onConfirm={wizard.handleConfirmLeave}
        title={formatMessage({ id: "app.hypercerts.wizard.leaveConfirm.title" })}
        description={formatMessage({ id: "app.hypercerts.wizard.unsavedChanges" })}
        confirmLabel={formatMessage({ id: "app.hypercerts.wizard.leaveConfirm.confirm" })}
        cancelLabel={formatMessage({ id: "app.hypercerts.wizard.leaveConfirm.cancel" })}
        variant="warning"
      />
      <ConfirmDialog
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
      <FormWizard
        steps={wizard.steps}
        currentStep={wizard.currentStep - 1}
        onNext={wizard.nextStep}
        onBack={wizard.previousStep}
        onCancel={onCancel}
        onSubmit={wizard.handleMint}
        onStepClick={wizard.handleStepClick}
        nextDisabled={wizard.nextDisabled}
        validationMessage={wizard.validationMessage}
        isSubmitting={wizard.isSubmitting}
        nextLabel={formatMessage({ id: "app.hypercerts.wizard.next" })}
        submitLabel={wizard.submitLabel}
      >
        <ErrorBoundary
          context={`HypercertWizard.Step${wizard.currentStep}`}
          onError={wizard.handleStepError}
        >
          {wizard.currentStep === 1 && (
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
          )}

          {wizard.currentStep === 2 && (
            <MetadataEditor
              draft={wizard.draft}
              onUpdate={(updates) => wizard.updateMetadata(updates)}
              suggestedWorkScopes={wizard.suggestedScopes}
              suggestedStart={wizard.suggestedTimeframe.start}
              suggestedEnd={wizard.suggestedTimeframe.end}
              selectedAssessment={wizard.selectedAssessment}
            />
          )}

          {wizard.currentStep === 3 && (
            <DistributionConfig
              mode={wizard.distributionMode}
              allowlist={wizard.allowlist}
              totalUnits={TOTAL_UNITS}
              onModeChange={wizard.setDistributionMode}
              onAllowlistChange={wizard.setAllowlist}
            />
          )}

          {wizard.currentStep === 4 && (
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
              onEditMetadata={() => wizard.setStep(2)}
              onEditDistribution={() => wizard.setStep(3)}
            />
          )}
        </ErrorBoundary>
      </FormWizard>
      <MintingDialog
        mintingState={wizard.mintingState}
        chainId={wizard.chainId}
        onCancel={wizard.cancel}
        onRetry={wizard.retry}
      />
    </>
  );
}
