import { adminRoutes, FormWizard } from "@green-goods/shared";
import { useIntl } from "react-intl";
import {
  BasicsStep,
  CapitalsStep,
  InstructionsStep,
  ReviewStep,
} from "@/components/Action/CreateActionSteps";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import { useCreateActionController } from "./useCreateActionController";

export default function CreateAction() {
  const { formatMessage } = useIntl();
  const createAction = useCreateActionController();
  const activeStepId = createAction.stepConfigs[createAction.currentStep]?.id;

  const stepRegistry = {
    basics: <BasicsStep form={createAction.form} domainOptions={createAction.domainOptions} />,
    capitals: <CapitalsStep form={createAction.form} />,
    instructions: <InstructionsStep form={createAction.form} />,
    review: <ReviewStep form={createAction.form} domainOptions={createAction.domainOptions} />,
  };

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
          to: adminRoutes.actions(),
          label: formatMessage({
            id: "app.actions.backToActions",
            defaultMessage: "Back to actions",
          }),
        }}
        sticky
      />
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
    </CanvasRouteFrame>
  );
}
