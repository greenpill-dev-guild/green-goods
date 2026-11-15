/**
 * Garden role definitions shared across hooks and utilities.
 *
 * Role keys are the in-repo name, and the Solidity enum member is `Steward`
 * too. The deployed access functions keep the older operator name, which is
 * why `steward` maps to `isOperator` and `isOperatorOf` below. Garden accounts
 * already deployed cannot be upgraded, so `isOperator` stays the name to call
 * on them.
 *
 * Centralized configuration for all 6 garden roles:
 * - Role IDs (for contract calls)
 * - Role functions (for contract view calls)
 * - Display order (for consistent UI ordering)
 * - Color schemes (for visual distinction)
 * - i18n keys (for localization)
 */

export const GARDEN_ROLE_IDS = {
  gardener: 0,
  evaluator: 1,
  steward: 2,
  owner: 3,
  funder: 4,
  community: 5,
} as const;

export type GardenRole = keyof typeof GARDEN_ROLE_IDS;

/**
 * GardenAccount permission views. They apply the inclusive hierarchy
 * (owner → steward → evaluator → gardener), so a steward reads as a gardener
 * even without the gardener hat. Use them for "may this account act as X".
 */
export const GARDEN_ROLE_FUNCTIONS = {
  gardener: "isGardener",
  evaluator: "isEvaluator",
  // Deployed contract function name — never rename this value.
  steward: "isOperator",
  owner: "isOwner",
  funder: "isFunder",
  community: "isCommunity",
} as const;

/**
 * HatsModule exact-membership views, `(garden, account) → wears this role's
 * hat`. This is the test `grantRole` uses to decide whether to mint, so use
 * these for "would granting X change anything".
 */
export const GARDEN_ROLE_HAT_FUNCTIONS = {
  gardener: "isGardenerOf",
  evaluator: "isEvaluatorOf",
  // Every deployed HatsModule has isOperatorOf; isStewardOf arrived with the relabel upgrade.
  steward: "isOperatorOf",
  owner: "isOwnerOf",
  funder: "isFunderOf",
  community: "isCommunityOf",
} as const;

/**
 * Canonical order for displaying roles in UI.
 * Owner first (highest privilege) → Community last (lowest privilege)
 */
export const GARDEN_ROLE_ORDER: readonly GardenRole[] = [
  "owner",
  "steward",
  "evaluator",
  "gardener",
  "funder",
  "community",
] as const;

/**
 * Color scheme names for role-based styling.
 * Maps to design system color tokens (e.g., bg-warning-lighter, text-warning-base)
 */
export type RoleColorScheme = "warning" | "info" | "feature" | "success" | "primary" | "neutral";

/**
 * Color scheme mapping for each role.
 * Used for badges, icons, and role cards.
 */
export const GARDEN_ROLE_COLORS: Record<GardenRole, RoleColorScheme> = {
  owner: "warning",
  steward: "info",
  evaluator: "feature",
  gardener: "success",
  funder: "primary",
  community: "neutral",
} as const;

/**
 * CSS classes for role color schemes.
 * Provides consistent styling across admin and client packages.
 */
export const ROLE_COLOR_CLASSES: Record<RoleColorScheme, { iconBg: string; iconText: string }> = {
  warning: {
    iconBg: "bg-warning-lighter",
    iconText: "text-warning-base",
  },
  info: {
    iconBg: "bg-information-lighter",
    iconText: "text-information-base",
  },
  feature: {
    iconBg: "bg-feature-lighter",
    iconText: "text-feature-dark",
  },
  success: {
    iconBg: "bg-success-lighter",
    iconText: "text-success-base",
  },
  primary: {
    iconBg: "bg-primary-lighter",
    iconText: "text-primary-base",
  },
  neutral: {
    iconBg: "bg-bg-weak",
    iconText: "text-text-soft",
  },
} as const;

/**
 * i18n key mappings for role labels.
 * Singular and plural forms for each role.
 */
export const GARDEN_ROLE_I18N_KEYS: Record<GardenRole, { singular: string; plural: string }> = {
  gardener: {
    singular: "app.roles.gardener",
    plural: "app.roles.gardener.plural",
  },
  steward: {
    singular: "app.roles.steward",
    plural: "app.roles.steward.plural",
  },
  evaluator: {
    singular: "app.roles.evaluator",
    plural: "app.roles.evaluator.plural",
  },
  owner: {
    singular: "app.roles.owner",
    plural: "app.roles.owner.plural",
  },
  funder: {
    singular: "app.roles.funder",
    plural: "app.roles.funder.plural",
  },
  community: {
    singular: "app.roles.community",
    plural: "app.roles.community.plural",
  },
} as const;

/**
 * Why the cockpit will not offer to remove one role from one person, or null when it will.
 *
 * - `no-access`: the viewer is neither an owner nor a steward of the garden.
 * - `own-access`: the viewer's own Owner or Steward role; giving up your own access is not a
 *   removal you make for someone else.
 * - `owner-only`: a steward looking at someone who holds Owner. Only an owner changes an
 *   owner's roles.
 * - `owner-steward`: a steward looking at another person's Steward role. Only an owner
 *   removes a steward.
 * - `last-owner`: the garden's only Owner role. A garden keeps at least one owner.
 *
 * `owner-only` and `owner-steward` follow the garden's role ranks; `own-access` and
 * `last-owner` are the cockpit's own guards against locking a garden out of its management.
 */
export type GardenRoleRemovalBlock =
  | "no-access"
  | "own-access"
  | "owner-only"
  | "owner-steward"
  | "last-owner";

export interface GardenRoleRemovalInput {
  /** Who is looking: the account the cockpit signs with. */
  viewer?: string | null;
  viewerIsOwner: boolean;
  /** Owners and stewards manage roles. */
  viewerCanManage: boolean;
  viewerCanManageStewards?: boolean;
  person: string;
  /** Every role the person holds in the garden. */
  personRoles: readonly GardenRole[];
  role: GardenRole;
  /** How many people hold Owner in the garden. */
  ownerCount: number;
}

export function gardenRoleRemovalBlock({
  viewer,
  viewerIsOwner,
  viewerCanManage,
  viewerCanManageStewards = false,
  person,
  personRoles,
  role,
  ownerCount,
}: GardenRoleRemovalInput): GardenRoleRemovalBlock | null {
  if (!viewerCanManage && !viewerIsOwner && !(role === "steward" && viewerCanManageStewards))
    return "no-access";
  const isSelf = Boolean(viewer) && viewer?.toLowerCase() === person.toLowerCase();
  if (isSelf && (role === "owner" || role === "steward")) return "own-access";
  if (role === "steward" && viewerCanManageStewards) return null;
  if (!viewerIsOwner) {
    if (personRoles.includes("owner")) return "owner-only";
    if (role === "steward") return "owner-steward";
  }
  if (role === "owner" && ownerCount <= 1) return "last-owner";
  return null;
}

/**
 * Helper to get color classes for a role.
 */
export function getRoleColorClasses(role: GardenRole) {
  return ROLE_COLOR_CLASSES[GARDEN_ROLE_COLORS[role]];
}

/**
 * Helper to get localized role labels (singular and plural).
 */
export function getRoleLabel(
  role: GardenRole,
  formatMessage: (descriptor: { id: string }) => string
) {
  return {
    singular: formatMessage({ id: GARDEN_ROLE_I18N_KEYS[role].singular }),
    plural: formatMessage({ id: GARDEN_ROLE_I18N_KEYS[role].plural }),
  };
}
