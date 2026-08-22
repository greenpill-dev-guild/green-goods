import type { IntlShape } from "react-intl";

/**
 * The one sanctioned public percentage: fulfilled over due, whole percent.
 *
 * Whole-percent rounding turns a near-boundary record into a categorical
 * claim — 999 kept of 1,000 due reads as "100%", 1 of 1,000 as "0%" — and
 * the public surfaces show the rate without the due count beside it, so the
 * reader cannot see the rounding. A rate that is not perfect is published as
 * ">99%" and a rate that is not zero as "<1%"; the counts behind it stay in
 * the record. Callers only reach this from `selectPublicPromiseKeptRate`'s
 * `rate` branch, so the threshold has already been applied.
 */
export function formatKeptRate(
  formatNumber: IntlShape["formatNumber"],
  fulfilled: bigint,
  due: bigint
): string {
  const percent = (value: number) =>
    formatNumber(value, { style: "percent", maximumFractionDigits: 0 });
  const ratio = Number(fulfilled) / Number(due);
  if (fulfilled > 0n && ratio < 0.005) return `<${percent(0.01)}`;
  if (fulfilled < due && ratio >= 0.995) return `>${percent(0.99)}`;
  return percent(ratio);
}
