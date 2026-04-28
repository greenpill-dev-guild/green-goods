import {
  adminRoutes,
  FormWizard,
  getActionsListSearch,
  useCreateActionController,
} from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useLocation } from "react-router-dom";
import {
  BasicsStep,
  CapitalsStep,
  InstructionsStep,
  ReviewStep,
} from "@/components/Action/CreateActionSteps";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";

interface CreateActionProps {
  layout?: "page" | "sheet";
}

export default function CreateAction({ layout = "page" }: CreateActionProps = {}) {
  const { formatMessage } = useIntl();
  const location = useLocation();
  const createAction = useCreateActionController();
  const activeStepId = createAction.stepConfigs[createAction.currentStep]?.id;
  const listSearch = useMemo(
    () => getActionsListSearch(new URLSearchParams(location.search)),
    [location.search]
  );
  const actionsListHref = useMemo(() => adminRoutes.actions(listSearch), [listSearch]);

  const stepRegistry = {
    basics: <BasicsStep form={createAction.form} domainOptions={createAction.domainOptions} />,
    capitals: <CapitalsStep form={createAction.form} />,
    instructions: <InstructionsStep form={createAction.form} />,
    review: <ReviewStep form={createAction.form} domainOptions={createAction.domainOptions} />,
  };

  const wizard = (
    <FormWizard
      steps={createAction.stepConfigs}
      currentStep={createAction.currentStep}
      onNext={createAction.handleNext}
      onBack={createAction.handleBack}
      onCancel={createAction.handleCancel}
      onSubmit={createAction.form.handleSubmit(createAction.onSubmit)}
      isSubmitting={createAction.isLoading}
    >
      {activeStepId ? stepRegistry[activeStepId as keyof typeof stepRegistry] : null}
    </FormWizard>
  );

  if (layout === "sheet") {
    return (
      <div className="space-y-4 p-4">
        <p className="text-sm text-text-sub">
          {formatMessage({
            id: "cockpit.actions.createDescription",
            defaultMessage:
              "Define the registry record, timeline, and submission requirements for a new action.",
          })}
        </p>
        {wizard}
      </div>
    );
  }

  return (
    <CanvasRouteFrame>
      <CanvasRouteHeader
        title={formatMessage({
          id: "admin.actions.createAction",
          defaultMessage: "Create action",
        })}
        description={formatMessage({
          id: "cockpit.actions.createDescription",
          defaultMessage:
            "Define the registry record, timeline, and submission requirements for a new action.",
        })}
        variant="canvas"
        backLink={{
          to: actionsListHref,
          label: formatMessage({
            id: "app.actions.backToActions",
            defaultMessage: "Back to actions",
          }),
        }}
        sticky
      />
      {wizard}
    </CanvasRouteFrame>
  );
}
