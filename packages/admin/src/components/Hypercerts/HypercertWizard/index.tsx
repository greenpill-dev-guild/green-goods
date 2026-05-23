import {
  Button,
  ErrorBoundary,
  logger,
  TOTAL_UNITS,
  toastService,
  useWizardData,
  type HypercertCompletionData,
  type HypercertWizardProps,
} from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { MintingDialog } from "@/components/Hypercerts/MintingDialog";
import { AttestationSelector } from "@/components/Hypercerts/Steps/AttestationSelector";
import { DistributionConfig } from "@/components/Hypercerts/Steps/DistributionConfig";
import { HypercertPreview } from "@/components/Hypercerts/Steps/HypercertPreview";
import { MetadataEditor } from "@/components/Hypercerts/Steps/MetadataEditor";
import { FormFlow, toFormFlowSections } from "@/components/Layout/FormFlow";

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
      <FormFlow
        layout="sheet"
        sections={toFormFlowSections(wizard.steps, sectionContent)}
        feedback={
          validationMessage ? (
            <div
              role="status"
              className="rounded-[var(--radius-lg)] border border-warning-light bg-warning-lighter px-3 py-2 text-sm text-warning-dark"
            >
              {validationMessage}
            </div>
          ) : undefined
        }
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={wizard.isSubmitting}
            >
              {formatMessage({ id: "app.wizard.cancel", defaultMessage: "Cancel" })}
            </Button>
            <Button
              type="button"
              onClick={wizard.handleMint}
              disabled={mintDisabled}
              loading={wizard.isSubmitting}
            >
              {wizard.submitLabel}
            </Button>
          </>
        }
      />
      <MintingDialog
        mintingState={wizard.mintingState}
        chainId={wizard.chainId}
        onCancel={wizard.cancel}
        onRetry={wizard.retry}
      />
    </>
  );
}
