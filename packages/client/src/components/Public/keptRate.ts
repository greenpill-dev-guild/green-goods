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
 *
 * Everything is decided in integer arithmetic on the counters. The boundary
 * tests are cross-multiplications (`fulfilled / due < 1/200` ⇔
 * `200 · fulfilled < due`; `≥ 199/200` ⇔ `200 · fulfilled ≥ 199 · due`),
 * and the whole percent itself is `⌊(200 · fulfilled + due) / (2 · due)⌋`,
 * round-half-up, so a uint256-scale counter a hair under a boundary cannot
 * become the boundary on its way to a double — 0.995 − 10⁻³⁰ narrows to
 * exactly 0.995, which a float formatter would round to "100%". Only the
 * finished whole percent is narrowed, and that is always a small integer.
 */
export function formatKeptRate(
  formatNumber: IntlShape["formatNumber"],
  fulfilled: bigint,
  due: bigint
): string {
  const percent = (value: number) =>
    formatNumber(value, { style: "percent", maximumFractionDigits: 0 });
  if (fulfilled > 0n && fulfilled * 200n < due) return `<${percent(0.01)}`;
  if (fulfilled < due && fulfilled * 200n >= due * 199n) return `>${percent(0.99)}`;
  const wholePercent = (fulfilled * 200n + due) / (due * 2n);
  return percent(Number(wholePercent) / 100);
}
