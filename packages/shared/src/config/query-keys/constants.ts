import type { AttestationFilters } from "../../types/hypercerts";

export const serializeAttestationFilters = (filters?: AttestationFilters): string => {
  if (!filters) return "";

  const normalizeDate = (value?: Date | number | null) => {
    if (value === null || value === undefined) return undefined;
    return value instanceof Date ? value.toISOString() : value;
  };

  return JSON.stringify({
    startDate: normalizeDate(filters.startDate),
    endDate: normalizeDate(filters.endDate),
    domain: filters.domain ?? undefined,
    workScope: filters.workScope ?? undefined,
    actionType: filters.actionType ?? undefined,
    gardenerAddress: filters.gardenerAddress ? filters.gardenerAddress.toLowerCase() : undefined,
    searchQuery: filters.searchQuery?.trim() || undefined,
  });
};

/** Fast-changing data (queue status, uploading jobs) */
export const STALE_TIME_FAST = 5_000; // 5 seconds

/** Medium-frequency data (approvals, recent works) */
export const STALE_TIME_MEDIUM = 30_000; // 30 seconds

/** Slow-changing data (gardens, actions) */
export const STALE_TIME_SLOW = 60_000; // 1 minute

/** Rarely changing data (user profile, settings) */
export const STALE_TIME_RARE = 300_000; // 5 minutes

/** Default retry configuration */
export const DEFAULT_RETRY_COUNT = 3;
export const DEFAULT_RETRY_DELAY = 1000; // 1 second

/** Delay for follow-up query invalidation to handle indexer lag */
export const INDEXER_LAG_FOLLOWUP_MS = 2000 as const;

/** Progressive invalidation delays for indexer lag (strictly increasing) */
export const INDEXER_LAG_SCHEDULE_MS = [2_000, 5_000, 15_000] as const;
