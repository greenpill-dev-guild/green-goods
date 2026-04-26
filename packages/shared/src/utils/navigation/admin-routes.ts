import type { Address } from "../../types/domain";

export type AdminWorkspaceId = "home" | "hub" | "garden" | "community" | "actions" | "profile";

export type AdminSignalPoolType = "hypercert" | "action";
export type AdminHubMode = "work" | "assess" | "certify" | "history";
export type AdminHubView = AdminHubMode;
export type AdminGardenMode = "overview" | "impact" | "settings";
export type AdminCommunityMode = "treasury" | "governance" | "payouts" | "members";
export type AdminHubSort = "newest" | "oldest";

export type AdminSearchValue = string | number | boolean | null | undefined;

export interface AdminHubRouteContext {
  gardenAddress?: Address | string;
  sort?: AdminHubSort;
}

export interface AdminGardenRouteContext {
  gardenAddress?: Address | string;
  range?: string;
  section?: string;
  item?: string;
}

export interface AdminCommunityRouteContext {
  gardenAddress?: Address | string;
  item?: string;
}

export const ADMIN_GARDEN_SHARE_PARAM = "gardenAddress";

export const ADMIN_WORKSPACE_ROOTS: Record<AdminWorkspaceId, string> = {
  home: "/",
  hub: "/hub",
  garden: "/garden",
  community: "/community",
  actions: "/actions",
  profile: "/profile",
};

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

export function buildAdminHref(
  pathname: string,
  search?: Record<string, AdminSearchValue>
): string {
  if (!search) return pathname;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function buildHubContextSearch(
  context?: AdminHubRouteContext
): Record<string, AdminSearchValue> | undefined {
  if (!context) return undefined;

  return {
    [ADMIN_GARDEN_SHARE_PARAM]: context.gardenAddress,
    sort: context.sort,
  };
}

function buildGardenContextSearch(
  context?: AdminGardenRouteContext
): Record<string, AdminSearchValue> | undefined {
  if (!context) return undefined;

  return {
    [ADMIN_GARDEN_SHARE_PARAM]: context.gardenAddress,
    range: context.range,
    section: context.section,
    item: context.item,
  };
}

function buildCommunityContextSearch(
  context?: AdminCommunityRouteContext
): Record<string, AdminSearchValue> | undefined {
  if (!context) return undefined;

  return {
    [ADMIN_GARDEN_SHARE_PARAM]: context.gardenAddress,
    item: context.item,
  };
}

export const adminRoutes = {
  hub(context?: AdminHubRouteContext) {
    return this.hubWork(context);
  },
  hubMode(mode: AdminHubMode, context?: AdminHubRouteContext) {
    return buildAdminHref(`/hub/${mode}`, buildHubContextSearch(context));
  },
  hubWork(context?: AdminHubRouteContext) {
    return this.hubMode("work", context);
  },
  hubAssess(context?: AdminHubRouteContext) {
    return this.hubMode("assess", context);
  },
  hubCertify(context?: AdminHubRouteContext) {
    return this.hubMode("certify", context);
  },
  hubHistory(context?: AdminHubRouteContext) {
    return this.hubMode("history", context);
  },
  hubHistoryDetail(eventId: string, context?: AdminHubRouteContext) {
    return buildAdminHref(`/hub/history/${encodeSegment(eventId)}`, buildHubContextSearch(context));
  },
  hubWorkDetail(workId: string, context?: AdminHubRouteContext) {
    return buildAdminHref(`/hub/work/${encodeSegment(workId)}`, buildHubContextSearch(context));
  },
  hubWorkSubmit(context?: AdminHubRouteContext) {
    return buildAdminHref("/hub/work/submit", buildHubContextSearch(context));
  },
  hubAssessCreate(context?: AdminHubRouteContext) {
    return buildAdminHref("/hub/assess/create", buildHubContextSearch(context));
  },
  hubCertifyDetail(assessmentId: string, context?: AdminHubRouteContext) {
    return buildAdminHref(
      `/hub/certify/${encodeSegment(assessmentId)}`,
      buildHubContextSearch(context)
    );
  },
  hubCertifyCreate(context?: AdminHubRouteContext) {
    return buildAdminHref("/hub/certify/create", buildHubContextSearch(context));
  },
  garden(context?: AdminGardenRouteContext) {
    return this.gardenOverview(context);
  },
  gardenMode(mode: AdminGardenMode, context?: AdminGardenRouteContext) {
    return buildAdminHref(`/garden/${mode}`, buildGardenContextSearch(context));
  },
  gardenOverview(context?: AdminGardenRouteContext) {
    return this.gardenMode("overview", context);
  },
  gardenImpact(context?: AdminGardenRouteContext) {
    return this.gardenMode("impact", context);
  },
  gardenSettings(context?: AdminGardenRouteContext) {
    return this.gardenMode("settings", context);
  },
  gardenCreate() {
    return "/garden/create";
  },
  gardenHypercertDetail(hypercertId: string, context?: AdminGardenRouteContext) {
    return buildAdminHref(
      `/garden/impact/hypercerts/${encodeSegment(hypercertId)}`,
      buildGardenContextSearch(context)
    );
  },
  community(context?: AdminCommunityRouteContext) {
    return this.communityTreasury(context);
  },
  communityMode(mode: AdminCommunityMode, context?: AdminCommunityRouteContext) {
    return buildAdminHref(`/community/${mode}`, buildCommunityContextSearch(context));
  },
  communityTreasury(context?: AdminCommunityRouteContext) {
    return this.communityMode("treasury", context);
  },
  communityGovernance(context?: AdminCommunityRouteContext) {
    return this.communityMode("governance", context);
  },
  communityPayouts(context?: AdminCommunityRouteContext) {
    return this.communityMode("payouts", context);
  },
  communityMembers(context?: AdminCommunityRouteContext) {
    return this.communityMode("members", context);
  },
  communityTreasuryVault(context?: AdminCommunityRouteContext) {
    return buildAdminHref("/community/treasury/vault", buildCommunityContextSearch(context));
  },
  communityGovernanceStrategies(context?: AdminCommunityRouteContext) {
    return buildAdminHref("/community/governance/strategies", buildCommunityContextSearch(context));
  },
  communityGovernanceSignalPool(
    poolType: AdminSignalPoolType,
    context?: AdminCommunityRouteContext
  ) {
    return buildAdminHref(
      `/community/governance/signal-pool/${encodeSegment(poolType)}`,
      buildCommunityContextSearch(context)
    );
  },
  actions(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/actions", search);
  },
  profile(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/profile", search);
  },
  actionCreate(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/actions/create", search);
  },
  actionDetail(actionId: string, search?: Record<string, AdminSearchValue>) {
    return buildAdminHref(`/actions/${encodeSegment(actionId)}`, search);
  },
  actionEdit(actionId: string, search?: Record<string, AdminSearchValue>) {
    return buildAdminHref(`/actions/${encodeSegment(actionId)}/edit`, search);
  },
  share(pathname: string, gardenAddress: string, search?: Record<string, AdminSearchValue>) {
    return buildAdminHref(pathname, {
      ...search,
      [ADMIN_GARDEN_SHARE_PARAM]: gardenAddress,
    });
  },
};

export function getAdminWorkspaceForPath(pathname: string): AdminWorkspaceId {
  // Check exact "/" match first — home workspace only for root path
  if (pathname === "/") return "home";

  for (const [workspaceId, root] of Object.entries(ADMIN_WORKSPACE_ROOTS) as Array<
    [AdminWorkspaceId, string]
  >) {
    if (workspaceId === "home") continue; // Skip — handled above
    if (pathname === root || pathname.startsWith(`${root}/`)) {
      return workspaceId;
    }
  }

  return "hub";
}

export function getAdminWorkspaceRoot(pathname: string): string {
  return ADMIN_WORKSPACE_ROOTS[getAdminWorkspaceForPath(pathname)];
}
