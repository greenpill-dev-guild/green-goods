/**
 * Garden reporting lab: the walkthrough's data in the shapes the shipped components take.
 * A lab record becomes the Hub's `Work` for HubWorkCard, and the review queue becomes the
 * Garden alerts the shipped rule raises (`useGardenDerivedState`): critical when review has
 * stalled, a warning when work has waited over a week.
 */
import { type Address, Domain, type Work } from "@green-goods/shared/types/domain";
import type { IntlShape } from "react-intl";
import type { GardenAlert } from "@/views/Garden/components/GardenAlertsCard";
import { statusAt } from "./aggregate";
import type { MediaKey, MediaSet, ReportDataset, WorkRecord } from "./model";
import type { ReviewHealth } from "./reviewHealth";

const DOMAIN_OF: Record<MediaKey, Domain | undefined> = {
  waste: Domain.WASTE,
  edu: Domain.EDU,
  agro: Domain.AGRO,
  banner: undefined,
};

/** The garden's domain, for the Hub card's badge. */
export function gardenDomain(dataset: ReportDataset): Domain | undefined {
  return DOMAIN_OF[dataset.garden.media];
}

/** A stable stand-in address, so the Hub's types hold. The lab never shows it. */
function standInAddress(seed: string): Address {
  let hash = 0x811c9dc5;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return `0x${hash.toString(16).padStart(8, "0").repeat(5)}`;
}

/** A lab record as the Hub's Work, its status read at `at`. */
export function toHubWork(
  record: WorkRecord,
  dataset: ReportDataset,
  media: MediaSet,
  at: number
): Work {
  const status = statusAt(record, at);
  const reviewed = record.reviewedAt !== undefined && record.reviewedAt <= at;
  return {
    id: record.id,
    title: record.title,
    actionUID: dataset.garden.actions.findIndex((action) => action.id === record.actionId),
    gardenerAddress: standInAddress(record.accountId),
    gardenAddress: standInAddress(dataset.garden.id),
    feedback: record.feedback ?? "",
    metadata: "",
    media: [media[record.media]],
    createdAt: Math.floor(record.submittedAt / 1000),
    status: status === "unknown" ? "pending" : status,
    reviewedAt: reviewed && record.reviewedAt ? Math.floor(record.reviewedAt / 1000) : undefined,
  };
}

/** Pending work that has waited a week or more, by the review-health age bands. */
export function waitingOverWeek(health: ReviewHealth): number {
  return health.bands
    .filter((band) => band.id === "1-2w" || band.id === "over-2w")
    .reduce((sum, band) => sum + band.records.length, 0);
}

/** The work alert the shipped Garden rule raises for this queue, with its copy. */
export function reviewAlerts(
  health: ReviewHealth,
  formatMessage: IntlShape["formatMessage"],
  onAction: () => void
): GardenAlert[] {
  if (health.tone === "error") {
    return [
      {
        key: "work-critical",
        severity: "critical",
        label: formatMessage(
          { id: "app.garden.detail.alert.workCritical" },
          { count: health.pending.length }
        ),
        onAction,
      },
    ];
  }
  const overWeek = waitingOverWeek(health);
  return overWeek > 0
    ? [
        {
          key: "work-warning",
          severity: "warn",
          label: formatMessage({ id: "app.garden.detail.alert.workWarning" }, { count: overWeek }),
          onAction,
        },
      ]
    : [];
}
