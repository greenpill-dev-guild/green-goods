import {
  adminRoutes,
  Button,
  FormWizard,
  TxInlineFeedback,
  useCreateGardenController,
} from "@green-goods/shared";
import { useIntl } from "react-intl";
import { DetailsStep } from "@/components/Garden/CreateGardenSteps/DetailsStep";
import { ReviewStep } from "@/components/Garden/CreateGardenSteps/ReviewStep";
import { TeamStep } from "@/components/Garden/CreateGardenSteps/TeamStep";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";

export default function CreateGarden() {
  const intl = useIntl();
  const createGarden = useCreateGardenController();
  const activeStepId = createGarden.steps[createGarden.currentStep]?.id;
  const stepRegistry = {
    details: <DetailsStep showValidation={createGarden.showValidation} />,
    team: <TeamStep />,
    review: <ReviewStep />,
  };

  return (
    <CanvasRouteFrame>
      <CanvasRouteHeader
        title={intl.formatMessage({
          id: "admin.gardens.createGarden",
          defaultMessage: "Create Garden",
        })}
        description={intl.formatMessage({
          id: "cockpit.garden.createDescription",
          defaultMessage:
            "Set the garden profile, team plan, and deployment details before going on chain.",
        })}
        variant="canvas"
        backLink={{
          to: adminRoutes.garden(),
          label: intl.formatMessage({
            id: "cockpit.nav.garden",
            defaultMessage: "Garden",
          }),
        }}
        sticky
      />
      <FormWizard
        steps={createGarden.steps}
        currentStep={createGarden.currentStep}
        onNext={createGarden.handleNext}
        onBack={createGarden.handleBack}
        onCancel={createGarden.handleCancel}
        onSubmit={createGarden.handleSubmit}
        onStepClick={createGarden.handleStepClick}
        isSubmitting={createGarden.isSubmitting}
        nextLabel={intl.formatMessage({
          id: "admin.garden.form.continue",
          defaultMessage: "Continue",
        })}
        submitLabel={intl.formatMessage({
          id: "admin.garden.form.deploy",
          defaultMessage: "Deploy garden",
        })}
      >
        <TxInlineFeedback
          visible={createGarden.hasError}
          severity={createGarden.txErrorView.severity}
          title={createGarden.errorTitle}
          message={createGarden.errorMessage}
          reserveClassName="min-h-[8.25rem]"
          className="mb-4"
          action={
            <Button variant="secondary" size="sm" onClick={createGarden.retry}>
              {intl.formatMessage({
                id: "admin.garden.deploy.retry",
                defaultMessage: "Retry deployment",
              })}
            </Button>
          }
        />
        {activeStepId ? stepRegistry[activeStepId as keyof typeof stepRegistry] : null}
      </FormWizard>
    </CanvasRouteFrame>
  );
}
