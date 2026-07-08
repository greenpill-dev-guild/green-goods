import { type Address, adminRoutes } from "@green-goods/shared";

export type AdminWorkspaceSectionTab = "overview" | "impact" | "work" | "community";

interface AdminWorkspaceSectionRouteOptions {
  tab: AdminWorkspaceSectionTab;
  section: string;
  itemId?: string;
  hubSort?: "newest" | "oldest";
  gardenId?: Address | string;
  gardenAddress?: Address | string;
}

export function resolveAdminWorkspaceSectionRoute(options: AdminWorkspaceSectionRouteOptions) {
  const { tab, section, itemId, hubSort } = options;
  const gardenId = options.gardenId ?? options.gardenAddress;

  if (tab === "work") {
    if (section === "work" && itemId) {
      return adminRoutes.hubWorkDetail(itemId, { gardenId, sort: hubSort });
    }

    if (section === "decisions" && itemId) {
      return adminRoutes.hubHistoryDetail(itemId, { gardenId, sort: hubSort });
    }

    return section === "decisions"
      ? adminRoutes.hubHistory({ gardenId, sort: hubSort })
      : adminRoutes.hubWork({ gardenId, sort: hubSort });
  }

  if (tab === "impact") {
    return adminRoutes.gardenImpact({ gardenId, item: itemId, section });
  }

  if (tab === "overview") {
    return adminRoutes.gardenHealth({ gardenId, item: itemId, section });
  }

  if (section === "members") return adminRoutes.communityMembers({ gardenId, item: itemId });
  if (section === "cookie-jars" || section === "payouts" || section === "yield") {
    return adminRoutes.communityPayouts({ gardenId, item: itemId });
  }
  if (section === "pools" || section === "governance" || section === "coordination") {
    return adminRoutes.communityCoordination({ gardenId, item: itemId });
  }
  if (section === "resources" || section === "endowment" || section === "treasury") {
    return adminRoutes.communityEndowment({ gardenId, item: itemId });
  }
  return adminRoutes.communityEndowment({ gardenId, item: itemId });
}
