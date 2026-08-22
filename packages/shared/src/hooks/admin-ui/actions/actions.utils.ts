import type { MetaStripItem } from "../../../components/Canvas/MetaStrip";
import { DOMAIN_CONFIG } from "../../../config/domain";
import { Capital, Domain, type Action } from "../../../types/domain";

export const DOMAIN_FILTER_OPTIONS = (
  Object.entries(DOMAIN_CONFIG) as [string, (typeof DOMAIN_CONFIG)[Domain]][]
).map(([key, config]) => ({
  value: Number(key) as Domain,
  labelId: config.labelId,
  colors: config.colors,
}));

/**
 * Capital enum → i18n key for its display name. Reuses the labels the Create
 * Action "Capitals" step already ships (all eight exist in en/es/pt), so action
 * cards and the detail dialog can name the forms of capital instead of showing
 * an abstract "{n} capital forms" count.
 */
export const ACTION_CAPITAL_LABEL_IDS: Record<Capital, string> = {
  [Capital.SOCIAL]: "app.admin.actions.create.capitalSocial",
  [Capital.MATERIAL]: "app.admin.actions.create.capitalMaterial",
  [Capital.FINANCIAL]: "app.admin.actions.create.capitalFinancial",
  [Capital.LIVING]: "app.admin.actions.create.capitalLiving",
  [Capital.INTELLECTUAL]: "app.admin.actions.create.capitalIntellectual",
  [Capital.EXPERIENTIAL]: "app.admin.actions.create.capitalExperiential",
  [Capital.SPIRITUAL]: "app.admin.actions.create.capitalSpiritual",
  [Capital.CULTURAL]: "app.admin.actions.create.capitalCultural",
};

export const ACTION_FILTER_DEFAULTS: Record<string, string | undefined> = {
  sort: "default",
  domain: undefined,
  search: undefined,
  lifecycle: "all",
};

const ACTION_LIST_QUERY_KEYS = ["sort", "domain", "search", "lifecycle"] as const;

export type LifecycleStage = "all" | "active" | "upcoming" | "completed";

export interface ActionsHeaderStatsInput {
  totalCount: number;
  domainsCovered: number;
  formatMessage: (
    descriptor: { id: string; defaultMessage?: string },
    values?: Record<string, string | number | boolean | Date | null | undefined>
  ) => string;
}

/**
 * Inline MetaStrip items for the Actions header so all four workspace headers
 * share the title · subtitle · stats anatomy. Deliberately registry-level and
 * additive — the domain tab rail already carries the per-domain counts, so the
 * header summarizes coverage instead (Frontend Rule 17). Stat shape (2 items):
 * total actions · domains covered.
 */
export function buildActionsHeaderStats({
  totalCount,
  domainsCovered,
  formatMessage,
}: ActionsHeaderStatsInput): MetaStripItem[] {
  return [
    {
      id: "total",
      value: String(totalCount),
      label: formatMessage(
        {
          id: "cockpit.actions.stats.total",
          defaultMessage: "{count, plural, one {action} other {actions}}",
        },
        { count: totalCount }
      ),
    },
    {
      id: "domains",
      value: String(domainsCovered),
      label: formatMessage(
        {
          id: "cockpit.actions.stats.domains",
          defaultMessage: "{count, plural, one {domain} other {domains}}",
        },
        { count: domainsCovered }
      ),
    },
  ];
}

export const LIFECYCLE_TABS: { id: LifecycleStage; labelId: string; defaultLabel: string }[] = [
  { id: "all", labelId: "cockpit.actions.stage.all", defaultLabel: "All" },
  { id: "active", labelId: "cockpit.actions.stage.active", defaultLabel: "Active" },
  { id: "upcoming", labelId: "cockpit.actions.stage.upcoming", defaultLabel: "Upcoming" },
  { id: "completed", labelId: "cockpit.actions.stage.completed", defaultLabel: "Completed" },
];

function normalizeTimestamp(value: number): number {
  return value > 10_000_000_000 ? value : value * 1000;
}

export function getActionLifecycleState(action: Pick<Action, "startTime" | "endTime">) {
  const now = Date.now();
  const start = normalizeTimestamp(action.startTime);
  const end = normalizeTimestamp(action.endTime);

  if (now < start) return "upcoming" as const;
  if (now > end) return "completed" as const;
  return "active" as const;
}

export function getWorkbenchTone(action: Pick<Action, "startTime" | "endTime">) {
  const lifecycle = getActionLifecycleState(action);
  if (lifecycle === "upcoming") return "pending" as const;
  if (lifecycle === "active") return "approved" as const;
  return "history" as const;
}

export function getActionsListSearch(searchParams: URLSearchParams): Record<string, string> {
  const listSearch: Record<string, string> = {};

  for (const key of ACTION_LIST_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (!value || value === ACTION_FILTER_DEFAULTS[key]) continue;
    listSearch[key] = value;
  }

  return listSearch;
}
