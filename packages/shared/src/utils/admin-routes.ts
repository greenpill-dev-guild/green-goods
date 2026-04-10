export type AdminWorkspaceId = "work" | "garden" | "community" | "actions" | "profile";

export type AdminSignalPoolType = "hypercert" | "action";

export type AdminSearchValue = string | number | boolean | null | undefined;

export const ADMIN_GARDEN_SHARE_PARAM = "gardenAddress";
export const ADMIN_GARDEN_LEGACY_PARAM = "garden";

export const ADMIN_WORKSPACE_ROOTS: Record<AdminWorkspaceId, string> = {
  work: "/work",
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

export const adminRoutes = {
  work(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/work", search);
  },
  workDetail(workId: string, search?: Record<string, AdminSearchValue>) {
    return buildAdminHref(`/work/${encodeSegment(workId)}`, search);
  },
  workSubmit(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/work/submit", search);
  },
  garden(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/garden", search);
  },
  gardenCreate() {
    return "/garden/create";
  },
  gardenAssessmentsCreate(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/garden/assessments/create", search);
  },
  gardenHypercertDetail(
    hypercertId: string,
    search?: Record<string, AdminSearchValue>
  ) {
    return buildAdminHref(`/garden/hypercerts/${encodeSegment(hypercertId)}`, search);
  },
  gardenHypercertCreate(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/garden/hypercerts/create", search);
  },
  community(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/community", search);
  },
  communityVault(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/community/vault", search);
  },
  communityStrategies(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/community/strategies", search);
  },
  communitySignalPool(
    poolType: AdminSignalPoolType,
    search?: Record<string, AdminSearchValue>
  ) {
    return buildAdminHref(`/community/signal-pool/${encodeSegment(poolType)}`, search);
  },
  actions(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/actions", search);
  },
  profile(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/profile", search);
  },
  actionCreate() {
    return "/actions/create";
  },
  actionDetail(actionId: string) {
    return `/actions/${encodeSegment(actionId)}`;
  },
  actionEdit(actionId: string) {
    return `/actions/${encodeSegment(actionId)}/edit`;
  },
  share(pathname: string, gardenAddress: string, search?: Record<string, AdminSearchValue>) {
    return buildAdminHref(pathname, {
      ...search,
      [ADMIN_GARDEN_SHARE_PARAM]: gardenAddress,
    });
  },
};

export function getAdminWorkspaceForPath(pathname: string): AdminWorkspaceId {
  for (const [workspaceId, root] of Object.entries(ADMIN_WORKSPACE_ROOTS) as Array<
    [AdminWorkspaceId, string]
  >) {
    if (pathname === root || pathname.startsWith(`${root}/`)) {
      return workspaceId;
    }
  }

  return "work";
}

export function getAdminWorkspaceRoot(pathname: string): string {
  return ADMIN_WORKSPACE_ROOTS[getAdminWorkspaceForPath(pathname)];
}
