import type { Address } from "../../../types/domain";
import { adminRoutes } from "../../../utils/navigation/admin-routes";

export type AdminWorkspaceSectionTab = "overview" | "impact" | "work" | "community";
export type AdminIndexRedirectKind =
  | "hub"
  | "garden"
  | "community"
  | "garden-overview"
  | "garden-members";

interface AdminWorkspaceSectionRouteOptions {
  tab: AdminWorkspaceSectionTab;
  section: string;
  itemId?: string;
  hubSort?: "newest" | "oldest";
  gardenId?: Address | string;
  gardenAddress?: Address | string;
}

function preserveAdminSearch(search: string, omitKeys: string[] = []): string {
  if (!search) return "";

  const params = new URLSearchParams(search);
  for (const key of omitKeys) params.delete(key);
  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

export function resolveAdminIndexRedirect(kind: AdminIndexRedirectKind, search: string): string {
  if (kind === "hub") {
    return `${adminRoutes.hubWork()}${preserveAdminSearch(search, ["view"])}`;
  }
  if (kind === "garden" || kind === "garden-overview") {
    return `${adminRoutes.gardenHealth()}${preserveAdminSearch(search, ["view"])}`;
  }
  if (kind === "community") {
    return `${adminRoutes.communityMembers()}${preserveAdminSearch(search, ["card", "pool"])}`;
  }
  return `${adminRoutes.communityMembers()}${preserveAdminSearch(search)}`;
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
