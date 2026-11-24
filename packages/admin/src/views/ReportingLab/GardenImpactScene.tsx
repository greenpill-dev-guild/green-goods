/**
 * Garden reporting lab, walkthrough (proposed): Garden's Impact tab with what the work
 * produced and what changed. The tab's split, Recent Hypercerts, Recent Assessments and the
 * rail's Impact Summary follow `ImpactTab`, filled from the lab's sample garden. New here,
 * above them: Output Trends (each measure weekly, reported against approved) and Evidence
 * and Outcomes (the baseline, a later observation marked proposed, and dated evidence).
 */
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { RiFileList3Line, RiMedalLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { statusAt } from "./aggregate";
import { DAY_IN_MS, formatDay } from "./dates";
import { EvidenceOutcomes } from "./EvidenceOutcomes";
import { GardenScene } from "./GardenScene";
import type { MediaSet, ReportDataset } from "./model";
import { OutputTrends } from "./OutputTrends";
import { GardenTabLayout } from "./SceneFrames";
import { scopeRecords } from "./scope";

interface GardenImpactSceneProps {
  dataset: ReportDataset;
  media: MediaSet;
}

export function GardenImpactScene({ dataset, media }: GardenImpactSceneProps) {
  const { formatMessage, locale } = useIntl();
  const { garden } = dataset;
  const at = dataset.reference;
  const approved30d = dataset.records.filter(
    (record) =>
      record.reviewedAt !== undefined &&
      record.reviewedAt > at - 30 * DAY_IN_MS &&
      statusAt(record, at) === "approved"
  ).length;
  const assessments = garden.baseline ? [garden.baseline] : [];

  return (
    <GardenScene dataset={dataset} media={media} view="impact">
      {({ scope, openRecords }) => (
        <GardenTabLayout
          main={
            <>
              <OutputTrends
                dataset={dataset}
                scope={scope}
                records={scopeRecords(dataset, scope)}
                onOpenRecords={openRecords}
                variant="summary"
              />
              <EvidenceOutcomes dataset={dataset} media={media} onOpenRecords={openRecords} />
              <AdminCard density="none">
                <AdminCardHeader>
                  <div>
                    <AdminCardTitle>
                      {formatMessage({ id: "app.garden.detail.impact.hypercertHighlights" })}
                    </AdminCardTitle>
                    <p className="mt-1 type-body text-text-sub">
                      {formatMessage({
                        id: "app.garden.detail.impact.hypercertHighlightsDescription",
                      })}
                    </p>
                  </div>
                </AdminCardHeader>
                <AdminCardBody>
                  <EmptyState
                    icon={<RiMedalLine className="h-6 w-6" />}
                    title={formatMessage({ id: "app.hypercerts.list.empty.title" })}
                    description={formatMessage({ id: "app.garden.detail.impact.noHypercertsHint" })}
                  />
                </AdminCardBody>
              </AdminCard>
              <AdminCard density="none">
                <AdminCardHeader>
                  <AdminCardTitle>
                    {formatMessage({ id: "app.garden.admin.recentAssessments" })}
                  </AdminCardTitle>
                </AdminCardHeader>
                <AdminCardBody>
                  <ul className="flex flex-col gap-(--gg-list-gap)">
                    {assessments.map((assessment) => (
                      <li key={assessment.title}>
                        <ItemRow
                          lead={{ kind: "icon", icon: <RiFileList3Line /> }}
                          title={assessment.title}
                          details={[
                            formatDay(assessment.createdOn, locale, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }),
                            garden.domainLabel,
                          ]}
                        />
                      </li>
                    ))}
                  </ul>
                </AdminCardBody>
              </AdminCard>
            </>
          }
          rail={
            <AdminCard density="none">
              <AdminCardHeader>
                <AdminCardTitle>
                  {formatMessage({ id: "app.garden.detail.impactSummary" })}
                </AdminCardTitle>
              </AdminCardHeader>
              <AdminCardBody className="space-y-3">
                <FactList frame="inset">
                  <FactRow
                    label={formatMessage({
                      id: "app.garden.detail.impactSummary.totalAssessments",
                    })}
                    value={assessments.length}
                  />
                  <FactRow
                    label={formatMessage({ id: "app.garden.detail.impactSummary.totalHypercerts" })}
                    value={0}
                  />
                  <FactRow
                    label={formatMessage({ id: "app.garden.detail.metric.approvedIn30d" })}
                    value={approved30d}
                  />
                </FactList>
                <p className="type-label-sm text-text-soft">
                  {formatMessage({ id: "app.garden.detail.domains" })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge variant="neutral">{garden.domainLabel}</StatusBadge>
                </div>
              </AdminCardBody>
            </AdminCard>
          }
        />
      )}
    </GardenScene>
  );
}
