/**
 * Garden reporting lab: one work record's evidence and facts, as the records dialog opens
 * it. Each date says which date it is, and a work-performed date shows only when the
 * work's details recorded one.
 */
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { useState } from "react";
import { useIntl } from "react-intl";
import { statusAt } from "./aggregate";
import { formatDay, formatMoment } from "./dates";
import { accountName, actionTitle, formatNumber, STATUS_COPY } from "./labCopy";
import type { MediaSet, ReportDataset, ViewerRole, WorkRecord } from "./model";

const QUANTITY_LABELS: Record<string, string> = {
  totalAmountKg: "Total sorted",
  amountTransferredKg: "Transferred",
  inputKg: "Batch input",
  outputKg: "Batch output",
  participants: "Participants",
  durationMin: "Duration",
  amountRemoved: "Amount removed",
  plannedDurationMin: "Planned length",
  capacity: "Capacity",
  deliveredDurationMin: "Delivered length",
  facilitators: "Facilitators",
  attendees: "Attendees verified",
};

const QUANTITY_UNITS: Record<string, string> = {
  totalAmountKg: "kg",
  amountTransferredKg: "kg",
  inputKg: "kg",
  outputKg: "kg",
  durationMin: "min",
  plannedDurationMin: "min",
  deliveredDurationMin: "min",
};

interface RecordFactsProps {
  record: WorkRecord;
  dataset: ReportDataset;
  media: MediaSet;
  role: ViewerRole;
  at: number;
  /** Opened over the Hub's queue, where the app's dialog holds the review form itself. */
  inHub?: boolean;
}

export function RecordFacts({ record, dataset, media, role, at, inHub = false }: RecordFactsProps) {
  const { locale } = useIntl();
  const [hubNote, setHubNote] = useState(false);
  const { garden } = dataset;
  const status = statusAt(record, at);
  const moment = (ms: number) => formatMoment(ms, locale, garden.timeZone);
  const account = garden.accounts.find((item) => item.id === record.accountId);
  const site = garden.sites.find((item) => item.id === record.siteId);
  const quantities = Object.entries(record.quantities);

  let reviewed = "Not reviewed yet";
  if (status === "unknown") reviewed = "The approval could not be read";
  else if (record.reviewedAt !== undefined && record.reviewedAt <= dataset.reference) {
    reviewed = `${moment(record.reviewedAt)} by ${accountName(garden, record.reviewerId ?? "")}`;
  }

  return (
    <div className="flex flex-col gap-3">
      <figure className="flex flex-col gap-1">
        <img
          src={media[record.media]}
          alt={`Evidence for ${record.title}`}
          className="h-48 w-full rounded-(--admin-radius-lg) object-cover sm:h-56"
        />
        <figcaption className="type-meta text-text-soft">
          {`Photo 1 of ${record.photoCount}. A sample image, not this work's own photo.`}
        </figcaption>
      </figure>
      <FactList frame="inset">
        <FactRow label="Action" value={actionTitle(garden, record.actionId)} />
        <FactRow
          label="Reported by"
          value={
            account?.kind === "shared-device"
              ? `${account.name} (shared device)`
              : accountName(garden, record.accountId)
          }
        />
        <FactRow
          label="Status"
          value={
            <StatusBadge variant={STATUS_COPY[status].tone}>
              {STATUS_COPY[status].label}
            </StatusBadge>
          }
        />
        <FactRow label="Submitted" value={moment(record.submittedAt)} />
        {record.sentFromDeviceAt !== undefined ? (
          <FactRow
            label="Sent from device"
            value={`${moment(record.sentFromDeviceAt)} (uploaded later)`}
          />
        ) : null}
        <FactRow
          label="Work performed"
          value={
            record.performedOn
              ? `${formatDay(record.performedOn, locale, { weekday: "short", month: "short", day: "numeric" })} (recorded in the work's details)`
              : "Not recorded"
          }
        />
        <FactRow label="Reviewed" value={reviewed} />
        {record.confidence ? (
          <FactRow label="Confidence" value={`${record.confidence}, ${record.method}`} />
        ) : null}
        {record.feedback ? <FactRow label="Feedback" value={record.feedback} /> : null}
        {quantities.map(([key, value]) => (
          <FactRow
            key={key}
            label={QUANTITY_LABELS[key] ?? key}
            value={
              value === null
                ? "Left empty"
                : `${formatNumber(value, locale)}${QUANTITY_UNITS[key] ? ` ${QUANTITY_UNITS[key]}` : ""}`
            }
          />
        ))}
        {record.quantityNote ? <FactRow label="Quantity note" value={record.quantityNote} /> : null}
        <FactRow
          label="Time spent"
          value={record.minutes === null ? "Not recorded" : `${record.minutes} min`}
        />
        <FactRow label="Location" value={site ? `${site.name} (approximate)` : "Not shared"} />
      </FactList>
      {inHub && role === "steward" && status === "pending" ? (
        <p className="type-meta text-text-sub">
          In the app, Review Work holds the review form here. The prototype shows the record only.
        </p>
      ) : null}
      {!inHub && role === "steward" && status === "pending" ? (
        <div className="flex flex-col items-end gap-1">
          <Button type="button" emphasis="secondary" size="sm" onClick={() => setHubNote(true)}>
            Review in Hub
          </Button>
          {hubNote ? (
            <p className="type-meta text-text-sub" role="status">
              In the product this opens the work in Hub, Work, scoped to this garden.
            </p>
          ) : null}
        </div>
      ) : null}
      {role !== "steward" && status === "pending" ? (
        <p className="type-meta text-text-sub">
          Stewards review work in Hub. This report only reads it.
        </p>
      ) : null}
    </div>
  );
}
