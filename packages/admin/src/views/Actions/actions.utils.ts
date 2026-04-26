import { type Action, DOMAIN_CONFIG, Domain } from "@green-goods/shared";

export const DOMAIN_FILTER_OPTIONS = (
  Object.entries(DOMAIN_CONFIG) as [string, (typeof DOMAIN_CONFIG)[Domain]][]
).map(([key, config]) => ({
  value: Number(key) as Domain,
  labelId: config.labelId,
  colors: config.colors,
}));

export const ACTION_FILTER_DEFAULTS: Record<string, string | undefined> = {
  sort: "default",
  domain: undefined,
  search: undefined,
  lifecycle: "all",
};

const ACTION_LIST_QUERY_KEYS = ["sort", "domain", "search", "lifecycle"] as const;

export type LifecycleStage = "all" | "active" | "upcoming" | "completed";

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
