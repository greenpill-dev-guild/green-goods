import { adminRoutes, type AdminGardenRouteContext, type FabConfig } from "@green-goods/shared";
import { RiAddLine, RiHandCoinLine, RiSettings3Line, RiUserAddLine } from "@remixicon/react";

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

  const communityRouteContext = { gardenAddress: routeContext?.gardenAddress };

  return {
    icon: RiAddLine,
    label: "Garden Actions",
    actions: [
      {
        id: "edit-garden",
        icon: RiSettings3Line,
        label: "Edit garden",
        labelId: "cockpit.garden.fab.editGarden",
      },
      {
        id: "invite-gardener",
        icon: RiUserAddLine,
        label: "Invite gardener",
        labelId: "cockpit.garden.fab.inviteGardener",
      },
      {
        id: "send-distribution",
        icon: RiHandCoinLine,
        label: "Send distribution",
        labelId: "cockpit.garden.fab.sendDistribution",
      },
    ],
    onAction: (actionId: string) => {
      if (actionId === "edit-garden") navigate(adminRoutes.gardenSettings(routeContext));
      else if (actionId === "invite-gardener")
        navigate(adminRoutes.communityMembers(communityRouteContext));
      else if (actionId === "send-distribution")
        navigate(adminRoutes.communityPayouts(communityRouteContext));
    },
  };
}
