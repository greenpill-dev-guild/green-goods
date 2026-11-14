/**
 * Garden reporting lab, walkthrough (proposed): Garden's Health tab with a Review Health
 * card under Garden Health. The Garden Health card (its verdict, range chips, three stats
 * and Key Metrics) and the rail's alerts follow `OverviewTab` in health mode; the rail's
 * setup and Karma panels read live data and are left out. New here is Review Health: the
 * shipped stall rule's verdict, waiting work by age and submitted against reviewed each
 * week. Its age bands hand off to the Hub's Work chips rather than opening a list here.
 */
import { StatTile } from "@green-goods/shared/components/Cards/StatTile";
import { useLocalizedRelativeTime } from "@green-goods/shared/hooks/app/useLocalizedRelativeTime";
import { useMediaQuery } from "@green-goods/shared/hooks/ui/useMediaQuery";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { GardenAlertsCard } from "@/views/Garden/components/GardenAlertsCard";
import { formatReviewTime } from "@/views/Garden/components/GardenDetailHelpers";
import { SECTION_CARD_MIN_HEIGHT } from "@/views/Garden/components/gardenDetail.constants";
import { statusAt } from "./aggregate";
import { DAY_IN_MS } from "./dates";
import { GardenKeyMetrics, GardenScene } from "./GardenScene";
import type { MediaSet, ReportDataset } from "./model";
import { ReviewHealthPanel } from "./ReviewHealthPanel";
import type { AgeBandId } from "./reviewHealth";
import { GardenTabLayout } from "./SceneFrames";

const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
type Range = keyof typeof RANGES;

interface GardenHealthSceneProps {
  dataset: ReportDataset;
  media: MediaSet;
}

export function GardenHealthScene({ dataset, media }: GardenHealthSceneProps) {
  const { formatMessage } = useIntl();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const relative = useLocalizedRelativeTime();
  const [range, setRange] = useState<Range>("30d");
  const [handoff, setHandoff] = useState<AgeBandId | null>(null);
  const at = dataset.reference;
  const span = RANGES[range] * DAY_IN_MS;
  const approvedBetween = (from: number, to: number) =>
    dataset.records.filter(
      (record) =>
        record.reviewedAt !== undefined &&
        record.reviewedAt > from &&
        record.reviewedAt <= to &&
        statusAt(record, to) === "approved"
    ).length;
  const approved = approvedBetween(at - span, at);
  const delta = approved - approvedBetween(at - 2 * span, at - span);
  const lastSubmitted = Math.max(
    ...dataset.records.map((record) => record.submittedAt).filter((moment) => moment <= at)
  );

  return (
    <GardenScene dataset={dataset} media={media} view="health">
      {({ scope, openRecords, health, alerts, gardeners }) => {
        const verdict = alerts.some((alert) => alert.severity === "critical")
          ? "critical"
          : alerts.length > 0
            ? "attention"
            : "healthy";
        const band = health.bands.find((item) => item.id === handoff);
        return (
          <GardenTabLayout
            main={
              <>
                {isDesktop ? null : <GardenAlertsCard alerts={alerts} />}
                <AdminCard
                  density="none"
                  className={`${SECTION_CARD_MIN_HEIGHT} garden-tab-main-own-height`}
                >
                  <AdminCardHeader className="flex-wrap gap-3">
                    <div>
                      <AdminCardTitle>
                        {formatMessage({ id: "app.garden.detail.health.title" })}
                      </AdminCardTitle>
                      <p className="mt-1 type-body text-text-sub">
                        {formatMessage({ id: `app.garden.detail.health.status.${verdict}` })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(Object.keys(RANGES) as Range[]).map((item) => (
                        <AdminFilterChip
                          key={item}
                          label={formatMessage({ id: `app.garden.detail.range.${item}` })}
                          selected={range === item}
                          onToggle={() => setRange(item)}
                        />
                      ))}
                    </div>
                  </AdminCardHeader>
                  <AdminCardBody>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-live="polite">
                      <StatTile
                        label={formatMessage({ id: "app.garden.detail.metric.lastActivity" })}
                        value={relative(lastSubmitted)}
                      />
                      <StatTile
                        label={formatMessage({ id: "app.garden.detail.metric.impactVelocity" })}
                        value={String(approved)}
                        delta={
                          delta === 0
                            ? formatMessage({ id: "app.garden.detail.metric.noDelta" })
                            : formatMessage(
                                {
                                  id:
                                    delta > 0
                                      ? "app.garden.detail.metric.deltaUp"
                                      : "app.garden.detail.metric.deltaDown",
                                },
                                { count: Math.abs(delta) }
                              )
                        }
                      />
                      <StatTile
                        label={formatMessage({
                          id: "app.garden.detail.metric.executionThroughput",
                        })}
                        value={formatReviewTime(
                          health.medianDays === null ? null : health.medianDays * DAY_IN_MS,
                          formatMessage
                        )}
                      />
                    </div>
                    <div className="mt-4 border-t border-stroke-soft">
                      <GardenKeyMetrics dataset={dataset} health={health} gardeners={gardeners} />
                    </div>
                  </AdminCardBody>
                </AdminCard>
                <ReviewHealthPanel
                  dataset={dataset}
                  scope={scope}
                  records={dataset.records}
                  media={media}
                  onOpenRecords={openRecords}
                  onOpenBand={setHandoff}
                  variant="summary"
                />
                {band ? (
                  <p className="type-meta text-text-sub" role="status">
                    {`In the app, this opens Hub › Work with “${band.label}” chosen.`}
                  </p>
                ) : null}
              </>
            }
            rail={isDesktop ? <GardenAlertsCard alerts={alerts} /> : null}
          />
        );
      }}
    </GardenScene>
  );
}
