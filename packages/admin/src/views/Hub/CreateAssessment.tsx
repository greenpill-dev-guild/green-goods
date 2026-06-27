import {
  Alert,
  ErrorBoundary,
  TxInlineFeedback,
  useCreateAssessmentController,
  useMediaQuery,
} from "@green-goods/shared";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import { ActionsHarvestStep } from "@/components/Assessment/CreateAssessmentSteps/ActionsHarvestStep";
import { DomainContextStep } from "@/components/Assessment/CreateAssessmentSteps/DomainContextStep";
import { StrategyKernelStep } from "@/components/Assessment/CreateAssessmentSteps/StrategyKernelStep";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { CanvasRouteFrame } from "@/components/Layout/CanvasRouteFrame";
import { FormFlow, toFormFlowSections } from "@/components/Layout/FormFlow";

// Create Assessment is a full-surface creation flow (desktop full-screen dialog /
// mobile full-page route — see routes/views.tsx), so it renders through the same
// ActionFlowShell grammar as Submit Work. Single phase: no target selection, just
// the stacked configure sections.
export default function CreateAssessment() {
  const { formatMessage } = useIntl();
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const layout = isDesktop ? "dialog" : "page";
  const createAssessment = useCreateAssessmentController();

  const title = formatMessage({
    id: "app.assessment.submitAssessment",
    defaultMessage: "Submit assessment",
  });
  const exitLabel = formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" });
  // On the mobile route the back-arrow is the only exit, so it cancels the flow;
  // in the desktop dialog the AdminDialog close button owns exit.
  const exitBack = layout === "page" ? createAssessment.handleCancel : undefined;

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

  let content: ReactNode;
  if (!createAssessment.garden) {
    content = (
      <ActionFlowShell layout={layout} title={title} onBack={exitBack} backLabel={exitLabel}>
        <Alert variant="error">{formatMessage({ id: "app.garden.admin.notFound" })}</Alert>
      </ActionFlowShell>
    );
  } else if (!createAssessment.canReview) {
    content = (
      <ActionFlowShell
        layout={layout}
        title={title}
        context={createAssessment.garden.name}
        onBack={exitBack}
        backLabel={exitLabel}
      >
        <Alert variant="warning">{formatMessage({ id: "app.admin.auth.noPermission" })}</Alert>
      </ActionFlowShell>
    );
  } else {
    const footer = (
      <>
        <div className="min-w-0 flex-1" aria-live="polite">
          {createAssessment.isSubmitting ? <AdminLinearProgress ariaLabel={title} /> : null}
        </div>
        <div className="flex gap-2">
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
            loading={createAssessment.isSubmitting}
            disabled={createAssessment.isSubmitting}
          >
            {formatMessage({
              id: "app.assessment.submitAssessment",
              defaultMessage: "Submit assessment",
            })}
          </AdminButton>
        </div>
      </>
    );

    content = (
      <ActionFlowShell
        layout={layout}
        title={title}
        context={createAssessment.garden.name}
        footer={footer}
        onBack={exitBack}
        backLabel={exitLabel}
      >
        <ErrorBoundary context="CreateAssessment.Wizard">
          <FormFlow
            layout="bare"
            feedback={
              createAssessment.hasError ? (
                <TxInlineFeedback
                  visible
                  severity={createAssessment.txErrorView.severity}
                  title={createAssessment.errorTitle}
                  message={createAssessment.errorMessage}
                  reserveClassName="min-h-0"
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
              ) : undefined
            }
            sections={toFormFlowSections(createAssessment.stepConfigs, stepRegistry)}
          />
        </ErrorBoundary>
      </ActionFlowShell>
    );
  }

  // Desktop: full-screen dialog. The body is neutralized to a non-scrolling flex
  // column so ActionFlowShell owns the pinned chrome + scrolling body. The
  // AdminDialog close button is the exit (→ controller handleCancel).
  if (isDesktop) {
    return (
      <AdminDialog
        open
        size="fullscreen"
        onOpenChange={(next) => {
          if (!next) createAssessment.handleCancel();
        }}
        title={title}
        description={formatMessage({
          id: "cockpit.assessment.createDescription",
          defaultMessage:
            "Capture the context, strategy kernel, and harvest window for a new assessment.",
        })}
        bodyClassName="flex min-h-0 flex-col !overflow-hidden"
      >
        {content}
      </AdminDialog>
    );
  }

  // Mobile: own full-page route filling the canvas viewport as a flex column so
  // the footer pins to the bottom.
  return (
    <CanvasRouteFrame className="flex min-h-[calc(100dvh-3.5rem)] flex-col !p-0">
      {content}
    </CanvasRouteFrame>
  );
}
