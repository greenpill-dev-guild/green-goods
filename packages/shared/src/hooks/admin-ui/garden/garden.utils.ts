import { adminRoutes, type AdminGardenRouteContext, type FabConfig } from "@green-goods/shared";
import { RiAddLine, RiSettings3Line } from "@remixicon/react";

/**
 * Per Tier 4 of the admin design handoff (audit IA-Garden decision):
 * Overview / Activity / Members / Settings. The legacy "impact" tab was
 * dropped — Hub Certify + History abstracts hypercert flow.
 */
export type GardenWorkspaceView = "overview" | "activity" | "members" | "settings";

export function resolveGardenView(pathname: string): GardenWorkspaceView {
  if (pathname.startsWith("/garden/activity")) return "activity";
  if (pathname.startsWith("/garden/members")) return "members";
  if (pathname.startsWith("/garden/settings")) return "settings";
  return "overview";
}

export function buildGardenFabConfig(
  view: GardenWorkspaceView,
  canManage: boolean,
  hasSelectedGarden: boolean,
  navigate: (path: string) => void,
  routeContext?: AdminGardenRouteContext
): FabConfig | null {
  if (!hasSelectedGarden || !canManage || view === "settings") return null;

  return {
    icon: RiAddLine,
    label: "Garden Actions",
    actions: [
      {
        id: "edit-garden",
        icon: RiSettings3Line,
        label: "Edit Garden",
        labelId: "cockpit.garden.fab.editGarden",
      },
    ],
    onAction: (actionId: string) => {
      if (actionId === "edit-garden") navigate(adminRoutes.gardenSettings(routeContext));
    },
  };
}
