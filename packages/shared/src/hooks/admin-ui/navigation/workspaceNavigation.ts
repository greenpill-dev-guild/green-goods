import { type Address, adminRoutes } from "@green-goods/shared";

export type AdminWorkspaceSectionTab = "overview" | "impact" | "work" | "community";

interface AdminWorkspaceSectionRouteOptions {
  tab: AdminWorkspaceSectionTab;
  section: string;
  itemId?: string;
  hubSort?: "newest" | "oldest";
  gardenAddress?: Address | string;
}

export function resolveAdminWorkspaceSectionRoute({
  tab,
  section,
  itemId,
  hubSort,
  gardenAddress,
}: AdminWorkspaceSectionRouteOptions) {
  if (tab === "work") {
    if (section === "work" && itemId) {
      return adminRoutes.hubWorkDetail(itemId, { gardenAddress, sort: hubSort });
    }

    if (section === "decisions" && itemId) {
      return adminRoutes.hubHistoryDetail(itemId, { gardenAddress, sort: hubSort });
    }

    return section === "decisions"
      ? adminRoutes.hubHistory({ gardenAddress, sort: hubSort })
      : adminRoutes.hubWork({ gardenAddress, sort: hubSort });
  }

  if (tab === "impact") {
    return adminRoutes.gardenImpact({ gardenAddress, item: itemId, section });
  }

  if (tab === "overview") {
    return adminRoutes.gardenOverview({ gardenAddress, item: itemId, section });
  }

  if (section === "members") return adminRoutes.communityMembers({ gardenAddress, item: itemId });
  if (section === "cookie-jars" || section === "payouts") {
    return adminRoutes.communityPayouts({ gardenAddress, item: itemId });
  }
  if (section === "pools" || section === "governance") {
    return adminRoutes.communityGovernance({ gardenAddress, item: itemId });
  }
  return adminRoutes.communityTreasury({ gardenAddress, item: itemId });
}
