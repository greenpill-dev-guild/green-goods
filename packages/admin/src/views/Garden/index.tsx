import { MetaStrip } from "@green-goods/shared";
import { AdminTabRail } from "@/components/AdminTabRail";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import { GardenSheetDescriptor } from "./components/GardenSheetDescriptor";
import { GardenWorkspaceContent } from "./components/GardenWorkspaceContent";
import { useGardenWorkspaceController } from "./useGardenWorkspaceController";
import { useIntl } from "react-intl";

// Paradigm: Mixed — overview = Data Landscape, impact = Data Landscape, settings = Command Surface.

export default function GardenView() {
  const { formatMessage } = useIntl();
  const garden = useGardenWorkspaceController();

  return (
    <CanvasRouteFrame ref={garden.containerRef}>
      <GardenSheetDescriptor
        hypercertId={garden.hypercertId}
        onCloseHypercertSheet={garden.handleCloseHypercertSheet}
      />

      <CanvasRouteHeader
        maxWidthClassName="max-w-[1400px]"
        title={formatMessage({ id: "cockpit.garden.title", defaultMessage: "Garden" })}
        description={formatMessage({
          id: "cockpit.garden.description",
          defaultMessage: "Manage your garden overview, impact metrics, and settings",
        })}
        variant="canvas"
        metadata={
          garden.selectedGarden ? (
            <MetaStrip items={[{ id: "garden", label: garden.selectedGarden.name }]} />
          ) : undefined
        }
        sticky
      >
        <AdminTabRail
          ariaLabel={formatMessage({
            id: "cockpit.garden.viewSwitcher",
            defaultMessage: "Garden views",
          })}
          activeId={garden.view}
          onChange={garden.handleTabChange}
          tabs={[
            {
              id: "overview",
              label: formatMessage({
                id: "cockpit.garden.overview",
                defaultMessage: "Overview",
              }),
              count: garden.derived.overviewAlerts.length || undefined,
            },
            {
              id: "impact",
              label: formatMessage({
                id: "cockpit.garden.impact",
                defaultMessage: "Impact",
              }),
              count: garden.hypercerts.length || undefined,
            },
            {
              id: "settings",
              label: formatMessage({
                id: "cockpit.garden.settings",
                defaultMessage: "Settings",
              }),
            },
          ]}
        />
      </CanvasRouteHeader>

      <GardenWorkspaceContent workspace={garden} />
    </CanvasRouteFrame>
  );
}
