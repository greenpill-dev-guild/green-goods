/**
 * Garden reporting lab, interface 8: evidence and outcomes. Recorded activity, reviewed
 * output and a measured outcome are three different things: approving work proves the
 * work, not the outcome. A later observation needs a follow-up assessment, which Green
 * Goods does not have yet, so it is labeled proposed and drawn only as an illustration.
 */
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { StatTile } from "@green-goods/shared/components/Cards/StatTile";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { RiFileSearchLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { measureValue, statusAt } from "./aggregate";
import { dayKeyOf, formatDay, monthOf } from "./dates";
import { accountName, actionTitle, formatQuantity } from "./labCopy";
import type { MediaSet, ReportDataset, WorkRecord } from "./model";
import type { RecordsRequest } from "./RecordsDialog";

interface EvidenceOutcomesProps {
  dataset: ReportDataset;
  media: MediaSet;
  onOpenRecords: (request: RecordsRequest) => void;
}

export function EvidenceOutcomes({ dataset, media, onOpenRecords }: EvidenceOutcomesProps) {
  const { locale } = useIntl();
  const { garden } = dataset;
  const { baseline, followUp } = garden;
  const day = (value: string) =>
    formatDay(value, locale, { month: "short", day: "numeric", year: "numeric" });

  if (!baseline) {
    return (
      <AdminCard>
        <EmptyState
          icon={<RiFileSearchLine className="h-6 w-6" />}
          title="No baseline yet"
          description="An assessment sets the baseline that later evidence is read against."
        />
      </AdminCard>
    );
  }

  const season = garden.windows.find((w) => w.kind === "season");
  const measure = garden.measures.find((m) => m.id === baseline.outputMeasureId);
  const inSeason = (record: WorkRecord) => {
    const d = dayKeyOf(record.submittedAt, garden.timeZone);
    return !season || (d >= season.start && d <= season.end);
  };
  const outputRecords = dataset.records.filter(
    (r) => inSeason(r) && (!measure?.actionId || r.actionId === measure.actionId)
  );
  const sum = (records: WorkRecord[]) =>
    records.reduce((total, r) => total + (measure ? (measureValue(r, measure) ?? 0) : 0), 0);
  const approved = outputRecords.filter((r) => statusAt(r, dataset.reference) === "approved");
  const evidence = dataset.records.filter(
    (r) =>
      r.actionId === baseline.evidenceActionId &&
      (!baseline.evidenceSiteId || r.siteId === baseline.evidenceSiteId) &&
      statusAt(r, dataset.reference) === "approved"
  );
  const months = new Set<string>();
  const perMonth = evidence.filter((r) => {
    const month = monthOf(dayKeyOf(r.submittedAt, garden.timeZone));
    if (months.has(month)) return false;
    months.add(month);
    return true;
  });

  return (
    <div className="flex flex-col gap-4 sm:gap-5" data-component="EvidenceOutcomes">
      <AdminCard density="none">
        <AdminCardHeader>
          <div className="min-w-0">
            <AdminCardTitle as="h2">{baseline.title}</AdminCardTitle>
            <p className="mt-1 type-body text-text-sub">{baseline.outcome}</p>
          </div>
        </AdminCardHeader>
        <AdminCardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            label="Recorded activity"
            value={
              measure
                ? formatQuantity(sum(outputRecords), measure.unit, locale)
                : `${outputRecords.length} records`
            }
            delta={`${outputRecords.length} records submitted${season ? ` in ${season.name}` : ""}, whatever their status`}
          />
          <StatTile
            label="Reviewed output"
            value={
              measure
                ? formatQuantity(sum(approved), measure.unit, locale)
                : `${approved.length} records`
            }
            delta="approved by a steward; proves the work, not the outcome"
          />
          <StatTile
            label="Measured outcome"
            value={followUp ? `${baseline.observation} to ${followUp.observation}` : "Not measured"}
            delta={
              followUp
                ? "illustrative: needs the proposed follow-up assessment"
                : "no later observation against the baseline"
            }
          />
        </AdminCardBody>
      </AdminCard>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <AdminCard density="none">
          <AdminCardHeader>
            <AdminCardTitle as="h3">Baseline</AdminCardTitle>
            <StatusBadge variant="success">Recorded</StatusBadge>
          </AdminCardHeader>
          <AdminCardBody>
            <FactList frame="inset">
              <FactRow label="Diagnosis" value={baseline.diagnosis} />
              <FactRow label="Metric" value={baseline.metric} />
              <FactRow label="Target" value={baseline.target} />
              <FactRow
                label="Observed"
                value={`${baseline.observation}, ${day(baseline.observedOn)}`}
              />
              <FactRow label="Method" value={baseline.method} />
              <FactRow
                label="Assessed by"
                value={`${accountName(garden, baseline.authorId)}, ${day(baseline.createdOn)}`}
              />
            </FactList>
          </AdminCardBody>
        </AdminCard>
        <AdminCard density="none">
          <AdminCardHeader>
            <AdminCardTitle as="h3">Later Observation</AdminCardTitle>
            <StatusBadge variant="info">Proposed</StatusBadge>
          </AdminCardHeader>
          <AdminCardBody>
            {followUp ? (
              <div className="flex flex-col gap-2">
                <p className="type-meta text-text-sub">
                  Illustration only. A follow-up assessment would record this; Green Goods does not
                  have one yet.
                </p>
                <FactList frame="inset">
                  <FactRow label="Metric" value={baseline.metric} />
                  <FactRow
                    label="Observed"
                    value={`${followUp.observation}, ${day(followUp.observedOn)}`}
                  />
                  <FactRow label="Method" value={followUp.method} />
                  <FactRow label="Against target" value={baseline.target} />
                </FactList>
              </div>
            ) : (
              <EmptyState
                icon={<RiFileSearchLine className="h-6 w-6" />}
                title="No later observation"
                description={`Nothing records what changed against "${baseline.metric.toLowerCase()}". A follow-up assessment is proposed, not available.`}
                placement="list"
              />
            )}
          </AdminCardBody>
        </AdminCard>
      </div>

      <AdminCard density="none">
        <AdminCardHeader>
          <div className="min-w-0">
            <AdminCardTitle as="h3">Dated Evidence</AdminCardTitle>
            <p className="mt-1 type-body text-text-sub">
              Approved {actionTitle(garden, baseline.evidenceActionId).toLowerCase()} records
              {baseline.evidenceSiteId
                ? ` at ${garden.sites.find((s) => s.id === baseline.evidenceSiteId)?.name}`
                : ""}
              , the first in each month.
            </p>
          </div>
        </AdminCardHeader>
        <AdminCardBody>
          {perMonth.length === 0 ? (
            <EmptyState
              icon={<RiFileSearchLine className="h-6 w-6" />}
              title="No dated evidence"
              description={`No approved ${actionTitle(garden, baseline.evidenceActionId).toLowerCase()} records yet, so there is nothing dated to compare with the baseline.`}
              placement="list"
            />
          ) : (
            <ul className="grid grid-cols-1 gap-(--gg-list-gap) sm:grid-cols-2">
              {perMonth.map((record) => (
                <li key={record.id}>
                  <ItemRow
                    lead={{ kind: "photo", src: media[record.media] }}
                    title={day(dayKeyOf(record.submittedAt, garden.timeZone))}
                    status={{ label: "Approved", tone: "success" }}
                    details={[
                      `by ${accountName(garden, record.reviewerId ?? "")}`,
                      `${record.confidence ?? "Unrated"} confidence, ${record.method ?? "method not given"}`,
                    ]}
                    onOpen={() =>
                      onOpenRecords({
                        title: "Dated Evidence",
                        scopeLine: "Approved evidence for the baseline",
                        records: perMonth,
                        at: dataset.reference,
                        openId: record.id,
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </AdminCardBody>
      </AdminCard>
    </div>
  );
}
