import {
  ErrorBoundary,
  logger,
  TOTAL_UNITS,
  toastService,
  useWizardData,
  type HypercertCompletionData,
  type HypercertWizardProps,
} from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import { MintingDialog } from "@/components/Hypercerts/MintingDialog";
import { AttestationSelector } from "@/components/Hypercerts/Steps/AttestationSelector";
import { DistributionConfig } from "@/components/Hypercerts/Steps/DistributionConfig";
import { HypercertPreview } from "@/components/Hypercerts/Steps/HypercertPreview";
import { MetadataEditor } from "@/components/Hypercerts/Steps/MetadataEditor";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { ActionFlowStepper } from "@/components/Layout/ActionFlowStepper";

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
  const mintDisabled = wizard.isSubmitting || wizard.selectedAttestations.length === 0;
  const validationMessage =
    wizard.selectedAttestations.length === 0 ? wizard.validationMessage : undefined;
  const isFirstStep = wizard.currentStep === 1;
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
      </ErrorBoundary>
    ),
  };

  return (
    <>
      <AdminConfirmDialog
        isOpen={wizard.showLeaveConfirm}
        onClose={wizard.handleCancelLeave}
        onConfirm={wizard.handleConfirmLeave}
        title={formatMessage({ id: "app.hypercerts.wizard.leaveConfirm.title" })}
        description={formatMessage({ id: "app.hypercerts.wizard.unsavedChanges" })}
        confirmLabel={formatMessage({ id: "app.hypercerts.wizard.leaveConfirm.confirm" })}
        cancelLabel={formatMessage({ id: "app.hypercerts.wizard.leaveConfirm.cancel" })}
        variant="warning"
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
        stepper={
          <ActionFlowStepper
            steps={wizard.steps}
            currentStep={wizard.currentStep}
            onStepClick={(step) => wizard.handleStepClick(step - 1)}
          />
        }
        footer={
          <>
            <div className="min-w-0 flex-1" aria-live="polite">
              {wizard.isSubmitting ? <AdminLinearProgress ariaLabel={wizard.submitLabel} /> : null}
            </div>
            <div className="flex gap-2">
              <AdminButton
                type="button"
                variant={isFirstStep ? "text" : "outlined"}
                onClick={isFirstStep ? onCancel : wizard.previousStep}
                disabled={wizard.isSubmitting}
              >
                {isFirstStep
                  ? formatMessage({ id: "app.wizard.cancel", defaultMessage: "Cancel" })
                  : formatMessage({ id: "app.common.back", defaultMessage: "Back" })}
              </AdminButton>
              {isLastStep ? (
                <AdminButton
                  type="button"
                  variant="filled"
                  onClick={wizard.handleMint}
                  disabled={mintDisabled}
                  loading={wizard.isSubmitting}
                >
                  {wizard.submitLabel}
                </AdminButton>
              ) : (
                <AdminButton
                  type="button"
                  variant="filled"
                  onClick={wizard.nextStep}
                  disabled={wizard.nextDisabled || wizard.isSubmitting}
                >
                  {formatMessage({ id: "app.common.next", defaultMessage: "Next" })}
                </AdminButton>
              )}
            </div>
          </>
        }
      >
        {activeStep ? (
          <div data-region={`hypercert-step-${activeStep.id}`} className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-text-strong">{activeStep.title}</h2>
              {activeStep.description ? (
                <p className="mt-0.5 text-sm text-text-soft">{activeStep.description}</p>
              ) : null}
            </div>
            {validationMessage ? (
              <div
                role="status"
                className="rounded-[var(--radius-lg)] border border-warning-light bg-warning-lighter px-3 py-2 text-sm text-warning-dark"
              >
                {validationMessage}
              </div>
            ) : null}
            {sectionContent[activeStep.id as keyof typeof sectionContent]}
          </div>
        ) : null}
      </ActionFlowShell>
      <MintingDialog
        mintingState={wizard.mintingState}
        chainId={wizard.chainId}
        onCancel={wizard.cancel}
        onRetry={wizard.retry}
      />
    </>
  );
}
