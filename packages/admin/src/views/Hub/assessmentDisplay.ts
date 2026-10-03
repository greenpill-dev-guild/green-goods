import { DOMAIN_CONFIG } from "@green-goods/shared/config/domain";
import type { Domain } from "@green-goods/shared/types/domain";
import { normalizeTimestamp } from "@green-goods/shared/utils/time";
import type { IntlShape } from "react-intl";

/**
 * The label id of the domain an assessment's attestation names, or null when
 * the value names no domain the cockpit knows.
 */
export function assessmentDomainLabelId(domain: number | null | undefined): string | null {
  if (domain === null || domain === undefined) return null;
  return DOMAIN_CONFIG[domain as Domain]?.labelId ?? null;
}

/**
 * An assessment's reporting period as one date range in the reader's language,
 * or null when either end is missing. Create Assessment stores each end as UTC
 * midnight of the calendar day the author picked, so the range is read in UTC:
 * a reader west of it would otherwise see the day before.
 */
export function formatReportingPeriod(
  intl: Pick<IntlShape, "formatDateTimeRange">,
  startDate: number | null | undefined,
  endDate: number | null | undefined
): string | null {
  if (!startDate || !endDate) return null;
  const start = normalizeTimestamp(startDate);
  const end = normalizeTimestamp(endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return intl.formatDateTimeRange(start, end, { dateStyle: "medium", timeZone: "UTC" });
}
