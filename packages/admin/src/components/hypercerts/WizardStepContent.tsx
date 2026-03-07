import {
  type AllowlistEntry,
  type DistributionMode,
  ErrorBoundary,
  type GardenAssessment,
  type HypercertAttestation,
  type HypercertDraft,
  type HypercertMetadata,
  logger,
  type MintingState,
  TOTAL_UNITS,
  toastService,
} from "@green-goods/shared";
import { useCallback } from "react";
import { useIntl } from "react-intl";
import type { Step } from "@/components/Form/StepIndicator";
import { AttestationSelector } from "@/components/hypercerts/steps/AttestationSelector";
import { DistributionConfig } from "@/components/hypercerts/steps/DistributionConfig";
import { HypercertPreview } from "@/components/hypercerts/steps/HypercertPreview";
import { MetadataEditor } from "@/components/hypercerts/steps/MetadataEditor";

interface WizardStepContentProps {
  currentStep: number;
  steps: Step[];
  attestations: HypercertAttestation[];
  selectedAttestationIds: string[];
  selectedAttestations: HypercertAttestation[];
  onToggleAttestation: (uid: string) => void;
  isLoading: boolean;
  hasError: boolean;
  bundledAttestations: Record<string, { hypercertId: string; title?: string | null }>;
  assessments: GardenAssessment[] | undefined;
  selectedAssessmentId: string | null;
  onAssessmentChange: (id: string | null) => void;
  draft: HypercertDraft;
  onUpdateMetadata: (updates: Partial<HypercertDraft>) => void;
  suggestedScopes: string[];
  suggestedTimeframe: { start: number | null; end: number | null };
  selectedAssessment: GardenAssessment | null;
  distributionMode: DistributionMode;
  allowlist: AllowlistEntry[];
  onModeChange: (mode: DistributionMode) => void;
  onAllowlistChange: (entries: AllowlistEntry[]) => void;
  previewMetadata: HypercertMetadata | null;
  gardenName: string;
  gardenId: string;
  mintingState: MintingState;
  chainId: number;
  onEditMetadata: () => void;
  onEditDistribution: () => void;
}

export function WizardStepContent({
  currentStep,
  steps,
  attestations,
  selectedAttestationIds,
  selectedAttestations,
  onToggleAttestation,
  isLoading,
  hasError,
  bundledAttestations,
  assessments,
  selectedAssessmentId,
  onAssessmentChange,
  draft,
  onUpdateMetadata,
  suggestedScopes,
  suggestedTimeframe,
  selectedAssessment,
  distributionMode,
  allowlist,
  onModeChange,
  onAllowlistChange,
  previewMetadata,
  gardenName,
  gardenId,
  mintingState,
  chainId,
  onEditMetadata,
  onEditDistribution,
}: WizardStepContentProps) {
  const { formatMessage } = useIntl();

  const handleStepError = useCallback(
    (error: Error) => {
      const stepName = steps[currentStep - 1]?.id ?? "unknown";
      toastService.error({
        title: formatMessage({ id: "app.hypercerts.wizard.error.title" }),
        message: formatMessage({ id: "app.hypercerts.wizard.error.message" }),
        context: `HypercertWizard step ${stepName}`,
        suppressLogging: true,
      });
      logger.error(`[HypercertWizard] Step ${stepName} crashed`, {
        message: error.message,
        stack: error.stack,
      });
    },
    [currentStep, formatMessage, steps]
  );

  return (
    <ErrorBoundary context={`HypercertWizard.Step${currentStep}`} onError={handleStepError}>
      {currentStep === 1 && (
        <AttestationSelector
          attestations={attestations}
          selectedIds={selectedAttestationIds}
          onToggle={onToggleAttestation}
          isLoading={isLoading}
          hasError={hasError}
          bundledInfo={bundledAttestations}
          assessments={assessments}
          selectedAssessmentId={selectedAssessmentId}
          onAssessmentChange={onAssessmentChange}
        />
      )}

      {currentStep === 2 && (
        <MetadataEditor
          draft={draft}
          onUpdate={onUpdateMetadata}
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
          onModeChange={onModeChange}
          onAllowlistChange={onAllowlistChange}
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
          onEditMetadata={onEditMetadata}
          onEditDistribution={onEditDistribution}
        />
      )}
    </ErrorBoundary>
  );
}
