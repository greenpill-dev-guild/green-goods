import { findDomainMetric } from "@green-goods/shared/config/domain";
import type { CynefinPhase, Domain, SmartOutcome } from "@green-goods/shared/types/domain";
import { DOMAIN_LABEL_IDS } from "@green-goods/shared/utils/garden-detail";
import type { IntlShape } from "react-intl";

export const CYNEFIN_LABEL_IDS: Record<CynefinPhase, string> = {
  0: "app.garden.assessments.cynefin.clear",
  1: "app.garden.assessments.cynefin.complicated",
  2: "app.garden.assessments.cynefin.complex",
  3: "app.garden.assessments.cynefin.chaotic",
};

/** The label id of the domain an attestation names, or null for a value outside the known domains. */
export function domainLabelId(domain: number): string | null {
  return DOMAIN_LABEL_IDS[domain as Domain] ?? null;
}

/**
 * How an outcome is measured, in the reader's language: the metric's name, and
 * its target when the author set one. The form leaves a target at zero until it
 * is filled in, so zero reads as no target rather than "Target: 0".
 */
export function outcomeMeasure(
  intl: Pick<IntlShape, "formatMessage" | "formatNumber">,
  domain: number,
  outcome: SmartOutcome
): string {
  const metric = findDomainMetric(domain, outcome.metric);
  // A key the domain does not list is shown as stored rather than dropped.
  const label = metric ? intl.formatMessage({ id: metric.labelId }) : outcome.metric;
  if (!(outcome.target > 0)) return label;

  const target = intl
    .formatMessage(
      { id: "app.garden.assessments.outcomeTarget" },
      {
        target: intl.formatNumber(outcome.target),
        metric: metric ? intl.formatMessage({ id: metric.unitId }) : "",
      }
    )
    .trim();
  return label ? `${label} · ${target}` : target;
}
