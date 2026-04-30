import {
  adminRoutes,
  ErrorBoundary,
  TxInlineFeedback,
  useCreateAssessmentController,
} from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { ActionsHarvestStep } from "@/components/Assessment/CreateAssessmentSteps/ActionsHarvestStep";
import { DomainContextStep } from "@/components/Assessment/CreateAssessmentSteps/DomainContextStep";
import { StrategyKernelStep } from "@/components/Assessment/CreateAssessmentSteps/StrategyKernelStep";
import { CanvasRouteErrorState } from "@/components/Layout/CanvasRouteState";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import { FormFlow, toFormFlowSections } from "@/components/Layout/FormFlow";

export default function CreateAssessment() {
  const { formatMessage } = useIntl();
  const createAssessment = useCreateAssessmentController();
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
          to: adminRoutes.hubAssess(createAssessment.hubContext),
          label: formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" }),
        }}
        sticky
      />
      <ErrorBoundary context="CreateAssessment.Wizard">
        <FormFlow
          sections={toFormFlowSections(createAssessment.stepConfigs, stepRegistry)}
          feedback={
            <TxInlineFeedback
              visible={createAssessment.hasError}
              severity={createAssessment.txErrorView.severity}
              title={createAssessment.errorTitle}
              message={createAssessment.errorMessage}
              reserveClassName="min-h-[8.5rem]"
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
          }
          actions={
            <>
              <AdminButton
                type="button"
                variant="text"
                onClick={createAssessment.handleCancel}
                disabled={createAssessment.isSubmitting}
              >
                {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
              </AdminButton>
              <AdminButton
                type="button"
                variant="filled"
                onClick={createAssessment.handleSubmit}
                disabled={createAssessment.isSubmitting}
                loading={createAssessment.isSubmitting}
              >
                {formatMessage({
                  id: "app.assessment.submitAssessment",
                  defaultMessage: "Submit assessment",
                })}
              </AdminButton>
            </>
          }
        />
      </ErrorBoundary>
    </CanvasRouteFrame>
  );
}
