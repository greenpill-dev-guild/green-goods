import type { Address } from "../../../types/domain";
import { adminRoutes } from "../../../utils/navigation/admin-routes";

export type AdminWorkspaceSectionTab = "overview" | "impact" | "work" | "community";
export type AdminIndexRedirectKind =
  | "review"
  | "garden"
  | "community"
  | "garden-overview"
  | "garden-members";

interface AdminWorkspaceSectionRouteOptions {
  tab: AdminWorkspaceSectionTab;
  section: string;
  itemId?: string;
  reviewSort?: "newest" | "oldest";
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
  if (kind === "review") {
    return `${adminRoutes.reviewWork()}${preserveAdminSearch(search, ["view"])}`;
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
  const { tab, section, itemId, reviewSort } = options;
  const gardenId = options.gardenId ?? options.gardenAddress;

  if (tab === "work") {
    if (section === "work" && itemId) {
      return adminRoutes.reviewWorkDetail(itemId, { gardenId, sort: reviewSort });
    }

    return adminRoutes.reviewWork({ gardenId, sort: reviewSort });
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
