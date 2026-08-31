import { TxInlineFeedback } from "@green-goods/shared/components/feedback/TxInlineFeedback";
import { useCreateGardenController } from "@green-goods/shared/hooks/admin-ui/garden/useCreateGardenController";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { DetailsStep } from "@/components/Garden/CreateGardenSteps/DetailsStep";
import { ReviewStep } from "@/components/Garden/CreateGardenSteps/ReviewStep";
import { TeamStep } from "@/components/Garden/CreateGardenSteps/TeamStep";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import { FormFlow, toFormFlowSections } from "@/components/Layout/FormFlow";

export default function CreateGarden() {
  const intl = useIntl();
  const createGarden = useCreateGardenController();
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
      <FormFlow
        sections={toFormFlowSections(createGarden.steps, stepRegistry)}
        feedback={
          <TxInlineFeedback
            visible={createGarden.hasError}
            severity={createGarden.txErrorView.severity}
            title={createGarden.errorTitle}
            message={createGarden.errorMessage}
            reserveClassName="min-h-[8.25rem]"
            action={
              <AdminButton variant="tonal" size="sm" onClick={createGarden.retry}>
                {intl.formatMessage({
                  id: "admin.garden.deploy.retry",
                  defaultMessage: "Retry Deployment",
                })}
              </AdminButton>
            }
          />
        }
        actions={
          <>
            <AdminButton
              type="button"
              variant="outlined"
              onClick={createGarden.handleCancel}
              disabled={createGarden.isSubmitting}
            >
              {intl.formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
            </AdminButton>
            <AdminButton
              type="button"
              variant="filled"
              onClick={createGarden.handleSubmit}
              disabled={createGarden.isSubmitting}
              loading={createGarden.isSubmitting}
            >
              {intl.formatMessage({
                id: "admin.garden.form.deploy",
                defaultMessage: "Deploy Garden",
              })}
            </AdminButton>
          </>
        }
      />
    </CanvasRouteFrame>
  );
}
