import { adminRoutes, ErrorBoundary, FormWizard, TxInlineFeedback } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { ActionsHarvestStep } from "@/components/Assessment/CreateAssessmentSteps/ActionsHarvestStep";
import { DomainContextStep } from "@/components/Assessment/CreateAssessmentSteps/DomainContextStep";
import { StrategyKernelStep } from "@/components/Assessment/CreateAssessmentSteps/StrategyKernelStep";
import { CanvasRouteErrorState } from "@/components/Layout/CanvasRouteState";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import { useCreateAssessmentController } from "./useCreateAssessmentController";

export default function CreateAssessment() {
  const { formatMessage } = useIntl();
  const createAssessment = useCreateAssessmentController();
  const activeStepId = createAssessment.stepConfigs[createAssessment.currentStep]?.id;
  const stepRegistry = {
    domainContext: (
      <DomainContextStep
        showValidation={createAssessment.showValidation}
        isSubmitting={createAssessment.isSubmitting}
        gardenDomainMask={createAssessment.normalizedGardenDomainMask}
      />
    ),
    strategy: (
      <StrategyKernelStep
        showValidation={createAssessment.showValidation}
        isSubmitting={createAssessment.isSubmitting}
      />
    ),
    actionsHarvest: (
      <ActionsHarvestStep
        showValidation={createAssessment.showValidation}
        isSubmitting={createAssessment.isSubmitting}
      />
    ),
  };

  if (!createAssessment.garden) {
    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          title={formatMessage({
            id: "app.assessment.submitAssessment",
            defaultMessage: "Submit assessment",
          })}
          description={formatMessage({ id: "app.garden.admin.notFound" })}
          variant="canvas"
          backLink={{
            to: adminRoutes.garden(),
            label: formatMessage({ id: "app.garden.admin.backToGardens" }),
          }}
          sticky
        />
        <CanvasRouteErrorState
          message={formatMessage({ id: "app.garden.admin.notFound" })}
          maxWidthClassName="max-w-6xl"
        />
      </CanvasRouteFrame>
    );
  }

  if (!createAssessment.canReview) {
    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          title={formatMessage({
            id: "app.assessment.submitAssessment",
            defaultMessage: "Submit assessment",
          })}
          description={formatMessage({ id: "app.admin.auth.noPermission" })}
          variant="canvas"
          backLink={{
            to: adminRoutes.garden(),
            label: formatMessage({ id: "app.garden.admin.backToGardens" }),
          }}
          sticky
        />
        <CanvasRouteErrorState
          variant="warning"
          message={formatMessage({ id: "app.admin.auth.noPermission" })}
          maxWidthClassName="max-w-6xl"
        />
      </CanvasRouteFrame>
    );
  }

  return (
    <CanvasRouteFrame>
      <CanvasRouteHeader
        title={formatMessage({
          id: "app.assessment.submitAssessment",
          defaultMessage: "Submit assessment",
        })}
        description={formatMessage({
          id: "cockpit.assessment.createDescription",
          defaultMessage:
            "Capture the context, strategy kernel, and harvest window for a new assessment.",
        })}
        variant="canvas"
        backLink={{
          to: adminRoutes.hubAssess(),
          label: formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" }),
        }}
        sticky
      />
      <ErrorBoundary context="CreateAssessment.Wizard">
        <FormWizard
          steps={createAssessment.stepConfigs}
          currentStep={createAssessment.currentStep}
          onNext={createAssessment.handleNext}
          onBack={createAssessment.handleBack}
          onCancel={createAssessment.handleCancel}
          onSubmit={createAssessment.handleSubmit}
          isSubmitting={createAssessment.isSubmitting}
          nextLabel={formatMessage({ id: "app.assessment.continue", defaultMessage: "Continue" })}
          submitLabel={formatMessage({
            id: "app.assessment.submitAssessment",
            defaultMessage: "Submit assessment",
          })}
        >
          <TxInlineFeedback
            visible={createAssessment.hasError}
            severity={createAssessment.txErrorView.severity}
            title={createAssessment.errorTitle}
            message={createAssessment.errorMessage}
            reserveClassName="min-h-[8.5rem]"
            className="mb-4"
            action={
              <div className="flex flex-wrap gap-2">
                <AdminButton
                  type="button"
                  variant="outlined"
                  size="sm"
                  onClick={createAssessment.retry}
                  disabled={!createAssessment.canRetry || createAssessment.isSubmitting}
                >
                  {formatMessage({
                    id: "app.assessment.retrySubmission",
                    defaultMessage: "Retry submission",
                  })}
                </AdminButton>
                <AdminButton
                  type="button"
                  variant="text"
                  size="sm"
                  onClick={() => createAssessment.resetWorkflow()}
                >
                  {formatMessage({
                    id: "app.assessment.editDetails",
                    defaultMessage: "Edit details",
                  })}
                </AdminButton>
              </div>
            }
          />
          {activeStepId ? stepRegistry[activeStepId as keyof typeof stepRegistry] : null}
        </FormWizard>
      </ErrorBoundary>
    </CanvasRouteFrame>
  );
}
