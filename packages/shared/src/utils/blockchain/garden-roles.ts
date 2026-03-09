/**
 * Garden role definitions shared across hooks and utilities.
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
  operator: 2,
  owner: 3,
  funder: 4,
  community: 5,
} as const;

export type GardenRole = keyof typeof GARDEN_ROLE_IDS;

export const GARDEN_ROLE_FUNCTIONS = {
  gardener: "isGardener",
  evaluator: "isEvaluator",
  operator: "isOperator",
  owner: "isOwner",
  funder: "isFunder",
  community: "isCommunity",
} as const;

/**
 * Canonical order for displaying roles in UI.
 * Owner first (highest privilege) → Community last (lowest privilege)
 */
export const GARDEN_ROLE_ORDER: readonly GardenRole[] = [
  "owner",
  "operator",
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
  operator: "info",
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
  operator: {
    singular: "app.roles.operator",
    plural: "app.roles.operator.plural",
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
