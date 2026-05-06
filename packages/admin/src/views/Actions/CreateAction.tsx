import {
  adminRoutes,
  Button,
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
import { FormFlow, toFormFlowSections } from "@/components/Layout/FormFlow";

interface CreateActionProps {
  layout?: "page" | "sheet";
}

export default function CreateAction({ layout = "page" }: CreateActionProps = {}) {
  const { formatMessage } = useIntl();
  const location = useLocation();
  const createAction = useCreateActionController();
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

  const flow = (
    <FormFlow
      layout={layout}
      sections={toFormFlowSections(createAction.stepConfigs, stepRegistry)}
      intro={
        layout === "sheet"
          ? formatMessage({
              id: "cockpit.actions.createDescription",
              defaultMessage:
                "Define the registry record, timeline, and submission requirements for a new action.",
            })
          : undefined
      }
      actions={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={createAction.handleCancel}
            disabled={createAction.isLoading}
          >
            {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
          </Button>
          <Button
            type="button"
            onClick={createAction.form.handleSubmit(createAction.onSubmit)}
            disabled={createAction.isLoading}
            loading={createAction.isLoading}
          >
            {formatMessage({
              id: "admin.actions.createAction",
              defaultMessage: "Create action",
            })}
          </Button>
        </>
      }
    />
  );

  // Sheet layout: FormFlow now emits its own SheetBody + pinned SheetFooter.
  // No outer wrapper needed.
  if (layout === "sheet") {
    return flow;
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
      {flow}
    </CanvasRouteFrame>
  );
}
