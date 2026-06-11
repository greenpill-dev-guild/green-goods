import {
  buildGardenHeaderStats,
  MetaStrip,
  useGardenWorkspaceController,
  useMediaQuery,
} from "@green-goods/shared";
import { useMemo } from "react";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminViewActions } from "@/components/AdminViewActions";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import { GardenSheetDescriptor } from "./components/GardenSheetDescriptor";
import { GardenWorkspaceContent } from "./components/GardenWorkspaceContent";
import { useIntl } from "react-intl";

// Paradigm: Mixed — overview = Data Landscape, impact = Data Landscape, settings = Command Surface.

export default function GardenView() {
  const { formatMessage } = useIntl();
  const garden = useGardenWorkspaceController();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const headerStats = useMemo(
    () =>
      buildGardenHeaderStats({
        hasSelectedGarden: Boolean(garden.selectedGarden),
        gardenerCount: garden.garden?.gardeners.length ?? 0,
        pendingWorkCount: garden.derived.pendingWorks.length,
        treasuryBalance: garden.treasuryBalance,
        formatMessage,
      }),
    [
      garden.selectedGarden,
      garden.garden?.gardeners.length,
      garden.derived.pendingWorks.length,
      garden.treasuryBalance,
      formatMessage,
    ]
  );

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
        title={formatMessage({ id: "cockpit.garden.title", defaultMessage: "Garden" })}
        description={formatMessage({
          id: "cockpit.garden.description",
          defaultMessage:
            "What's growing in this garden — overview, activity, gardeners, and settings.",
        })}
        metadata={
          headerStats.length > 0 ? <MetaStrip items={headerStats} density="inline" /> : undefined
        }
        actions={
          isDesktop && garden.desktopActions.length > 0 ? (
            // One mode-specific primary inline (Overview → Edit garden,
            // Members → Add member); other actions live in the overflow.
            // Read-only views (Activity) and Settings keep a clean header.
            <AdminViewActions
              items={garden.desktopActions}
              maxInline={garden.desktopActions.some((action) => action.primary) ? 1 : 0}
            />
          ) : undefined
        }
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
