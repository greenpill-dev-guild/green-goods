import { adminRoutes } from "@green-goods/shared";

export type AdminWorkspaceSectionTab = "overview" | "impact" | "work" | "community";

interface AdminWorkspaceSectionRouteOptions {
  tab: AdminWorkspaceSectionTab;
  section: string;
  itemId?: string;
  hubSort?: "newest" | "oldest";
}

export function resolveAdminWorkspaceSectionRoute({
  tab,
  section,
  itemId,
  hubSort,
}: AdminWorkspaceSectionRouteOptions) {
  if (tab === "work") {
    if (section === "work" && itemId) {
      return adminRoutes.hubWorkDetail(itemId, { sort: hubSort });
    }

    if (section === "decisions" && itemId) {
      return adminRoutes.hubHistoryDetail(itemId, { sort: hubSort });
    }

    return section === "decisions"
      ? adminRoutes.hubHistory({ sort: hubSort })
      : adminRoutes.hubWork({ sort: hubSort });
  }

  if (tab === "impact") {
    return adminRoutes.gardenImpact({ item: itemId, section });
  }

  if (tab === "overview") {
    return adminRoutes.gardenOverview({ item: itemId, section });
  }

  if (section === "members") return adminRoutes.communityMembers({ item: itemId });
  if (section === "cookie-jars" || section === "payouts") {
    return adminRoutes.communityPayouts({ item: itemId });
  }
  if (section === "pools" || section === "governance") {
    return adminRoutes.communityGovernance({ item: itemId });
  }
  return adminRoutes.communityTreasury({ item: itemId });
}
