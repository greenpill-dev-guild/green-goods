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

// Paradigm: Data Landscape — health, impact, and activity readouts. Settings opens as a dialog.

export default function GardenView() {
  const { formatMessage } = useIntl();
  const garden = useGardenWorkspaceController();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const headerStats = useMemo(
    () =>
      buildGardenHeaderStats({
        hasSelectedGarden: Boolean(garden.selectedGarden),
        gardenerCount: garden.garden?.gardeners.length ?? 0,
        // The garden's own certified output (hypercerts). Pending work is the
        // Hub's domain, so the header speaks to legacy, not the review queue.
        impactCount: garden.hypercertsLoading ? null : garden.hypercerts.length,
        formatMessage,
      }),
    [
      garden.selectedGarden,
      garden.garden?.gardeners.length,
      garden.hypercertsLoading,
      garden.hypercerts.length,
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
        poolSeedOpen={garden.poolSeedOpen}
        poolCommitmentId={garden.poolCommitmentId}
        poolCloseTo={garden.poolSheetCloseTo}
        gardenAddress={garden.selectedGarden?.id}
      />

      <CanvasRouteHeader
        title={formatMessage({ id: "cockpit.garden.title", defaultMessage: "Garden" })}
        description={formatMessage({
          id: "cockpit.garden.description",
          defaultMessage:
            "Internal tracking for garden health, outcome proof, and recent activity.",
        })}
        metadata={
          headerStats.length > 0 ? <MetaStrip items={headerStats} density="inline" /> : undefined
        }
        actions={
          isDesktop && garden.desktopActions.length > 0 ? (
            <AdminViewActions items={garden.desktopActions} />
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
              id: "health",
              label: formatMessage({
                id: "cockpit.garden.health",
                defaultMessage: "Health",
              }),
              count: garden.derived.overviewAlerts.length || undefined,
            },
            {
              id: "impact",
              label: formatMessage({
                id: "cockpit.garden.impact",
                defaultMessage: "Impact",
              }),
              count: garden.derived.impactBadge.count,
            },
            {
              id: "activity",
              label: formatMessage({
                id: "cockpit.garden.activity",
                defaultMessage: "Activity",
              }),
            },
            // The pool console is the steward's surface (uiux-spec §6.2): a
            // gardener reads the pool in the client, never here.
            ...(garden.canManage
              ? [
                  {
                    id: "pool",
                    label: formatMessage({
                      id: "cockpit.garden.pool.tab",
                      defaultMessage: "Pool",
                    }),
                  },
                ]
              : []),
          ]}
        />
      </CanvasRouteHeader>

      <GardenWorkspaceContent workspace={garden} />
    </CanvasRouteFrame>
  );
}
