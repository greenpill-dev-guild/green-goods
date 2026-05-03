import { useGardenWorkspaceController } from "@green-goods/shared";
import { AdminTabRail } from "@/components/AdminTabRail";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import { GardenSheetDescriptor } from "./components/GardenSheetDescriptor";
import { GardenWorkspaceContent } from "./components/GardenWorkspaceContent";
import { useIntl } from "react-intl";

// Paradigm: Mixed — overview = Data Landscape, impact = Data Landscape, settings = Command Surface.

export default function GardenView() {
  const { formatMessage } = useIntl();
  const garden = useGardenWorkspaceController();

  return (
    <CanvasRouteFrame
      ref={garden.containerRef}
      data-component="GardenWorkspace"
      data-region="workspace-garden"
    >
      <GardenSheetDescriptor
        hypercertId={garden.hypercertId}
        closeTo={garden.hypercertSheetCloseTo}
      />

      <CanvasRouteHeader
        maxWidthClassName="max-w-[1400px]"
        title={formatMessage({ id: "cockpit.garden.title", defaultMessage: "Garden" })}
        description={formatMessage({
          id: "cockpit.garden.description",
          defaultMessage:
            "What's growing in this garden — overview, activity, gardeners, and settings.",
        })}
        variant="canvas"
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
              id: "activity",
              label: formatMessage({
                id: "cockpit.garden.activity",
                defaultMessage: "Activity",
              }),
            },
            {
              id: "members",
              label: formatMessage({
                id: "cockpit.garden.members",
                defaultMessage: "Members",
              }),
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
