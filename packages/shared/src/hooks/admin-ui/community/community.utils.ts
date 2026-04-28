import { adminRoutes, type AdminCommunityRouteContext, type FabConfig } from "@green-goods/shared";
import { RiAddLine, RiMoneyDollarCircleLine, RiUserLine } from "@remixicon/react";

export type CommunityWorkspaceMode = "treasury" | "governance" | "payouts" | "members";

export function resolveCommunityMode(pathname: string): CommunityWorkspaceMode {
  if (pathname.startsWith("/community/governance")) return "governance";
  if (pathname.startsWith("/community/payouts")) return "payouts";
  if (pathname.startsWith("/community/members")) return "members";
  return "treasury";
}

export function communitySectionForMode(mode: CommunityWorkspaceMode) {
  if (mode === "governance") return "governance";
  if (mode === "payouts") return "cookie-jars";
  return mode;
}

export function buildCommunityFabConfig(
  canManage: boolean,
  hasSelectedGarden: boolean,
  navigate: (path: string) => void,
  routeContext?: AdminCommunityRouteContext
): FabConfig | null {
  if (!hasSelectedGarden || !canManage) return null;

  return {
    icon: RiAddLine,
    label: "Community Actions",
    actions: [
      {
        id: "add-member",
        icon: RiUserLine,
        label: "Add Member",
        labelId: "cockpit.community.fab.addMember",
      },
      {
        id: "manage-vault",
        icon: RiMoneyDollarCircleLine,
        label: "Manage Vault",
        labelId: "cockpit.community.fab.manageVault",
      },
    ],
    onAction: (actionId: string) => {
      if (actionId === "add-member") navigate(adminRoutes.communityMembers(routeContext));
      else if (actionId === "manage-vault")
        navigate(adminRoutes.communityTreasuryVault(routeContext));
    },
  };
}
