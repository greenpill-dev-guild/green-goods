import { adminRoutes } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { HypercertWizard } from "@/components/Hypercerts/HypercertWizard";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import { useCreateHypercertController } from "./useCreateHypercertController";

export default function CreateHypercert() {
  const { formatMessage } = useIntl();
  const createHypercert = useCreateHypercertController();

  if (!createHypercert.garden) {
    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          title={formatMessage({ id: "app.hypercerts.create.title" })}
          description={formatMessage({ id: "app.hypercerts.create.notFound" })}
          variant="canvas"
          backLink={{
            to: adminRoutes.garden(),
            label: formatMessage({ id: "app.hypercerts.backToGardens" }),
          }}
        />
      </CanvasRouteFrame>
    );
  }

  if (!createHypercert.canManage) {
    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          title={formatMessage({ id: "app.hypercerts.create.title" })}
          description={formatMessage({ id: "app.hypercerts.create.unauthorized" })}
          variant="canvas"
          backLink={{
            to: adminRoutes.gardenImpact({
              ...createHypercert.gardenRouteContext,
              section: "hypercerts",
            }),
            label: formatMessage({ id: "app.hypercerts.backToHypercerts" }),
          }}
        />
      </CanvasRouteFrame>
    );
  }

  return (
    <CanvasRouteFrame>
      <CanvasRouteHeader
        title={formatMessage({ id: "app.hypercerts.create.title" })}
        description={formatMessage(
          { id: "app.hypercerts.create.description" },
          { gardenName: createHypercert.garden.name }
        )}
        variant="canvas"
        backLink={{
          to: adminRoutes.gardenImpact({
            ...createHypercert.gardenRouteContext,
            section: "hypercerts",
          }),
          label: formatMessage({ id: "app.hypercerts.backToHypercerts" }),
        }}
        sticky
      />
      <HypercertWizard
        gardenId={createHypercert.garden.id}
        gardenName={createHypercert.garden.name}
        onCancel={createHypercert.handleCancel}
        onComplete={createHypercert.handleComplete}
      />
    </CanvasRouteFrame>
  );
}
