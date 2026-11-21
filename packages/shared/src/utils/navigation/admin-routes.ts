import type { Address } from "../../types/domain";
import { isZeroAddress } from "../blockchain/address";
import type { ReviewWaitingBand } from "../garden-detail";

export type AdminWorkspaceId =
  | "home"
  | "review"
  | "garden"
  | "community"
  | "cookies"
  | "actions"
  | "profile";

export type AdminSignalPoolType = "hypercert" | "action";
export type AdminReviewMode = "work" | "assess" | "certify" | "confirm";
export type AdminReviewView = AdminReviewMode;
export type AdminGardenMode = "health" | "activity" | "impact" | "pool";
export type AdminCommunityMode = "members" | "coordination" | "endowment" | "payouts";
export type AdminReviewSort = "newest" | "oldest";
/**
 * The Work tab's scope: work waiting for review, or work already approved. "all" is every
 * status at once, and exists only for one day's work opened from the Activity calendar.
 */
export type AdminReviewWorkScope = "pending" | "approved" | "all";

export type AdminSearchValue = string | number | boolean | null | undefined;

export interface AdminReviewRouteContext {
  gardenId?: Address | string;
  /** @deprecated Use gardenId. Kept so old call sites and bookmarks can normalize safely. */
  gardenAddress?: Address | string;
  sort?: AdminReviewSort;
  /**
   * The default stays out of the URL: pending, or every status when a day is named. So
   * "approved" is always written, and "pending" only beside a day.
   */
  scope?: AdminReviewWorkScope;
  /** One calendar day (`YYYY-MM-DD`, the reader's clock) the Work tab is narrowed to. */
  day?: string;
  /** How long pending work has waited, the band the Work tab is narrowed to. */
  waiting?: ReviewWaitingBand;
  /** A create flow that opens over the stage (DL-140). A Review URL's item holds nothing else. */
  item?: AdminReviewFlowItem;
}

export interface AdminGardenRouteContext {
  gardenId?: Address | string;
  /** @deprecated Use gardenId. Kept so old call sites and bookmarks can normalize safely. */
  gardenAddress?: Address | string;
  range?: string;
  /** The Activity calendar's month (`YYYY-MM`) and its open day (`YYYY-MM-DD`). */
  month?: string;
  day?: string;
  section?: string;
  item?: string;
}

export interface AdminCommunityRouteContext {
  gardenId?: Address | string;
  /** @deprecated Use gardenId. Kept so old call sites and bookmarks can normalize safely. */
  gardenAddress?: Address | string;
  item?: string;
  member?: Address;
}

export const ADMIN_GARDEN_ID_PARAM = "gardenId";
export const ADMIN_GARDEN_LEGACY_SHARE_PARAM = "gardenAddress";
export const ADMIN_GARDEN_SHARE_PARAM = ADMIN_GARDEN_ID_PARAM;

export const ADMIN_WORKSPACE_ROOTS: Record<AdminWorkspaceId, string> = {
  home: "/",
  review: "/review",
  garden: "/garden",
  community: "/community",
  cookies: "/cookies",
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

function buildReviewContextSearch(
  context?: AdminReviewRouteContext
): Record<string, AdminSearchValue> | undefined {
  if (!context) return undefined;

  return {
    [ADMIN_GARDEN_ID_PARAM]: context.gardenId ?? context.gardenAddress,
    sort: context.sort,
    scope:
      context.scope === "approved" || (context.day && context.scope === "pending")
        ? context.scope
        : undefined,
    day: context.day,
    waiting: context.waiting,
    item: parseReviewFlowItem(context.item),
  };
}

function buildReviewCreationContextSearch(
  context?: AdminReviewRouteContext
): Record<string, AdminSearchValue> | undefined {
  if (!context) return undefined;

  return {
    [ADMIN_GARDEN_ID_PARAM]: context.gardenId ?? context.gardenAddress,
  };
}

function buildGardenContextSearch(
  context?: AdminGardenRouteContext
): Record<string, AdminSearchValue> | undefined {
  if (!context) return undefined;

  return {
    [ADMIN_GARDEN_ID_PARAM]: context.gardenId ?? context.gardenAddress,
    range: context.range,
    month: context.month,
    day: context.day,
    section: context.section,
    item: context.item,
  };
}

function buildCommunityContextSearch(
  context?: AdminCommunityRouteContext
): Record<string, AdminSearchValue> | undefined {
  if (!context) return undefined;

  return {
    [ADMIN_GARDEN_ID_PARAM]: context.gardenId ?? context.gardenAddress,
    item: context.item,
    member: context.member,
  };
}

export const adminRoutes = {
  review(context?: AdminReviewRouteContext) {
    return this.reviewWork(context);
  },
  reviewMode(mode: AdminReviewMode, context?: AdminReviewRouteContext) {
    return buildAdminHref(`/review/${mode}`, buildReviewContextSearch(context));
  },
  reviewWork(context?: AdminReviewRouteContext) {
    return this.reviewMode("work", context);
  },
  reviewAssess(context?: AdminReviewRouteContext) {
    return this.reviewMode("assess", context);
  },
  reviewCertify(context?: AdminReviewRouteContext) {
    return this.reviewMode("certify", context);
  },
  reviewConfirm(context?: AdminReviewRouteContext) {
    return this.reviewMode("confirm", context);
  },
  reviewConfirmDetail(commitmentId: string, context?: AdminReviewRouteContext) {
    return buildAdminHref(
      `/review/confirm/${encodeSegment(commitmentId)}`,
      buildReviewContextSearch(context)
    );
  },
  reviewWorkDetail(workId: string, context?: AdminReviewRouteContext) {
    return buildAdminHref(
      `/review/work/${encodeSegment(workId)}`,
      buildReviewContextSearch(context)
    );
  },
  /** Submit Work over Work. The header action opens it over the active stage instead (DL-140). */
  reviewWorkSubmit(context?: AdminReviewRouteContext) {
    return buildAdminHref("/review/work", {
      ...buildReviewCreationContextSearch(context),
      item: SUBMIT_WORK_ROUTE_ITEM,
    });
  },
  /** Create Assessment over Assessments, the way in from outside the header (DL-140). */
  reviewAssessCreate(context?: AdminReviewRouteContext) {
    return buildAdminHref("/review/assess", {
      ...buildReviewCreationContextSearch(context),
      item: CREATE_ASSESSMENT_ROUTE_ITEM,
    });
  },
  reviewAssessDetail(assessmentId: string, context?: AdminReviewRouteContext) {
    return buildAdminHref(
      `/review/assess/${encodeSegment(assessmentId)}`,
      buildReviewContextSearch(context)
    );
  },
  /** Create Hypercert over Hypercerts, the way in from outside the header (DL-140). */
  reviewCertifyCreate(context?: AdminReviewRouteContext) {
    return buildAdminHref("/review/certify", {
      ...buildReviewCreationContextSearch(context),
      item: CREATE_HYPERCERT_ROUTE_ITEM,
    });
  },
  garden(context?: AdminGardenRouteContext) {
    return this.gardenHealth(context);
  },
  gardenMode(mode: AdminGardenMode, context?: AdminGardenRouteContext) {
    return buildAdminHref(`/garden/${mode}`, buildGardenContextSearch(context));
  },
  gardenHealth(context?: AdminGardenRouteContext) {
    return this.gardenMode("health", context);
  },
  /** @deprecated Use gardenHealth. Retained for old call sites and bookmarks. */
  gardenOverview(context?: AdminGardenRouteContext) {
    return this.gardenHealth(context);
  },
  gardenActivity(context?: AdminGardenRouteContext) {
    return this.gardenMode("activity", context);
  },
  /** @deprecated Membership now belongs to Community. */
  gardenMembers(context?: AdminGardenRouteContext) {
    return buildAdminHref("/garden/members", buildGardenContextSearch(context));
  },
  gardenImpact(context?: AdminGardenRouteContext) {
    return this.gardenMode("impact", context);
  },
  /** Edit Garden over Health. The header action opens it over the active tab instead (DL-140). */
  gardenSettings(context?: AdminGardenRouteContext) {
    return this.gardenHealth({ ...context, item: EDIT_GARDEN_ROUTE_ITEM });
  },
  /** The steward's pool console (uiux-spec §6.2). */
  gardenPool(context?: AdminGardenRouteContext) {
    return this.gardenMode("pool", context);
  },
  /** The seeding console, a route-backed dialog over the pool tab (§6.3). */
  /** The seeding wizard; `from` names a commitment in the pool to start it from. */
  gardenPoolSeed(context?: AdminGardenRouteContext, options?: { from?: string }) {
    return buildAdminHref("/garden/pool/seed", {
      ...buildGardenContextSearch(context),
      from: options?.from,
    });
  },
  /**
   * One commitment, opened in the pool tab's inspector (§6.7); `focus: "waiting"`
   * opens it at its waiting list, as a Waiting for approval row does (PRD-1025 D4).
   */
  gardenPoolCommitment(
    commitmentId: string,
    context?: AdminGardenRouteContext,
    options?: { focus?: "waiting" }
  ) {
    return buildAdminHref(`/garden/pool/${encodeSegment(commitmentId)}`, {
      ...buildGardenContextSearch(context),
      focus: options?.focus,
    });
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
    return this.communityMembers(context);
  },
  communityMode(mode: AdminCommunityMode, context?: AdminCommunityRouteContext) {
    return buildAdminHref(`/community/${mode}`, buildCommunityContextSearch(context));
  },
  communityMembers(context?: AdminCommunityRouteContext) {
    return this.communityMode("members", context);
  },
  communityCoordination(context?: AdminCommunityRouteContext) {
    return this.communityMode("coordination", context);
  },
  communityEndowment(context?: AdminCommunityRouteContext) {
    return this.communityMode("endowment", context);
  },
  communityPayouts(context?: AdminCommunityRouteContext) {
    return this.communityMode("payouts", context);
  },
  /** Protocol pool plus this garden's pool (uiux-spec §6.8). */
  /** @deprecated Use communityEndowment. */
  communityTreasury(context?: AdminCommunityRouteContext) {
    return this.communityEndowment(context);
  },
  /** @deprecated Use communityCoordination. */
  communityGovernance(context?: AdminCommunityRouteContext) {
    return this.communityCoordination(context);
  },
  /** @deprecated Use communityEndowment. */
  communityResources(context?: AdminCommunityRouteContext) {
    return this.communityEndowment(context);
  },
  communityEndowmentVault(context?: AdminCommunityRouteContext) {
    return buildAdminHref("/community/endowment/vault", buildCommunityContextSearch(context));
  },
  communityEndowmentVaultDeposit(context?: AdminCommunityRouteContext) {
    return buildAdminHref(
      "/community/endowment/vault/deposit",
      buildCommunityContextSearch(context)
    );
  },
  communityEndowmentVaultWithdraw(context?: AdminCommunityRouteContext) {
    return buildAdminHref(
      "/community/endowment/vault/withdraw",
      buildCommunityContextSearch(context)
    );
  },
  /** @deprecated Use communityEndowmentVault. */
  communityTreasuryVault(context?: AdminCommunityRouteContext) {
    return this.communityEndowmentVault(context);
  },
  /** @deprecated Use communityEndowmentVaultDeposit. */
  communityTreasuryVaultDeposit(context?: AdminCommunityRouteContext) {
    return this.communityEndowmentVaultDeposit(context);
  },
  /** @deprecated Use communityEndowmentVaultWithdraw. */
  communityTreasuryVaultWithdraw(context?: AdminCommunityRouteContext) {
    return this.communityEndowmentVaultWithdraw(context);
  },
  communityCoordinationStrategies(context?: AdminCommunityRouteContext) {
    return buildAdminHref(
      "/community/coordination/strategies",
      buildCommunityContextSearch(context)
    );
  },
  communityCoordinationSignalPool(
    poolType: AdminSignalPoolType,
    context?: AdminCommunityRouteContext
  ) {
    return buildAdminHref(
      `/community/coordination/signal-pool/${encodeSegment(poolType)}`,
      buildCommunityContextSearch(context)
    );
  },
  /** @deprecated Use communityCoordinationStrategies. */
  communityGovernanceStrategies(context?: AdminCommunityRouteContext) {
    return this.communityCoordinationStrategies(context);
  },
  /** @deprecated Use communityCoordinationSignalPool. */
  communityGovernanceSignalPool(
    poolType: AdminSignalPoolType,
    context?: AdminCommunityRouteContext
  ) {
    return this.communityCoordinationSignalPool(poolType, context);
  },
  actions(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/actions", search);
  },
  /** The alias that lands on the protocol garden's campaign cookie jars. */
  cookies(search?: Record<string, AdminSearchValue>) {
    return buildAdminHref("/cookies", search);
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
  share(pathname: string, gardenId: string, search?: Record<string, AdminSearchValue>) {
    return buildAdminHref(pathname, {
      ...search,
      [ADMIN_GARDEN_ID_PARAM]: gardenId,
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

  return "review";
}

export function getAdminWorkspaceRoot(pathname: string): string {
  return ADMIN_WORKSPACE_ROOTS[getAdminWorkspaceForPath(pathname)];
}

/** Community → Payouts items for the protocol garden's campaign cookie jars (DL-046). */
export const CAMPAIGN_JARS_ROUTE_ITEM = "campaigns";
export const CREATE_CAMPAIGN_JAR_ROUTE_ITEM = "create-campaign-jar";

/** Route items for the header actions whose dialogs open over any tab (DL-140). */
export const FUND_JAR_ROUTE_ITEM = "fund-jar";
export const ADD_MEMBER_ROUTE_ITEM = "add-member";
export const EDIT_GARDEN_ROUTE_ITEM = "edit-garden";
export const SUBMIT_WORK_ROUTE_ITEM = "submit-work";
export const CREATE_ASSESSMENT_ROUTE_ITEM = "create-assessment";
export const CREATE_HYPERCERT_ROUTE_ITEM = "create-hypercert";

export type AdminReviewFlowItem =
  | typeof SUBMIT_WORK_ROUTE_ITEM
  | typeof CREATE_ASSESSMENT_ROUTE_ITEM
  | typeof CREATE_HYPERCERT_ROUTE_ITEM;

/** The create flow a Review URL's item names, if it names one. */
export function parseReviewFlowItem(
  item: string | null | undefined
): AdminReviewFlowItem | undefined {
  return item === SUBMIT_WORK_ROUTE_ITEM ||
    item === CREATE_ASSESSMENT_ROUTE_ITEM ||
    item === CREATE_HYPERCERT_ROUTE_ITEM
    ? item
    : undefined;
}

/**
 * Where the campaign cookie jar URLs land: the protocol garden's Community →
 * Payouts, on its campaign jars or with Create Cookie Jar open. A chain that
 * names no root garden lands on Community.
 */
export function resolveCampaignCookieJarsRoute(
  rootGarden: string | null | undefined,
  options: { create?: boolean } = {}
): string {
  if (!rootGarden || isZeroAddress(rootGarden)) return adminRoutes.community();
  return adminRoutes.communityPayouts({
    gardenId: rootGarden,
    item: options.create ? CREATE_CAMPAIGN_JAR_ROUTE_ITEM : CAMPAIGN_JARS_ROUTE_ITEM,
  });
}
