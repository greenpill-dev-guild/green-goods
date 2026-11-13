/**
 * Garden reporting lab: the one drill-down for every report. A day, a week, an age band
 * or a site opens its records here, in the cockpit's AdminDialog, and a record opens its
 * evidence inside the same dialog so the way back keeps the list. Read-only: review
 * itself stays in Hub.
 */
import { Button } from "@green-goods/shared/components/Button";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { RiArrowLeftLine, RiInboxLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminDialog } from "@/components/AdminDialog";
import { countStatuses, statusAt } from "./aggregate";
import { type DayKey, formatMoment } from "./dates";
import { accountName, describeCounts, recordTitle, STATUS_COPY } from "./labCopy";
import type { MediaSet, ReportDataset, ViewerRole, WorkRecord } from "./model";
import { RecordFacts } from "./RecordFacts";

export interface RecordsRequest {
  title: string;
  /** What the list holds: which day, which filters, which statuses. */
  scopeLine: string;
  records: WorkRecord[];
  /** The moment statuses read at. */
  at: number;
  /** Said in place of an empty list when the reason is not "nothing happened". */
  emptyNote?: string;
  /** Opens one record's evidence straight away; Back still leads to the list. */
  openId?: string;
  /** The calendar day the records came from, when they came from one. */
  day?: DayKey;
}

interface RecordsDialogProps {
  request: RecordsRequest | null;
  onClose: () => void;
  dataset: ReportDataset;
  media: MediaSet;
  role: ViewerRole;
  /** The workspace the dialog opens over, for its accent. */
  tone?: "garden" | "hub" | "community";
  /** Opened over the Hub's queue, where the app's dialog holds the review form. */
  inHub?: boolean;
}

const PAGE = 12;

function RecordsBody({
  request,
  dataset,
  media,
  role,
  inHub,
}: Omit<RecordsDialogProps, "onClose"> & { request: RecordsRequest }) {
  const { locale } = useIntl();
  const [openId, setOpenId] = useState<string | null>(request.openId ?? null);
  const [shown, setShown] = useState(PAGE);
  const { garden } = dataset;
  const newestFirst = [...request.records].sort((a, b) => b.submittedAt - a.submittedAt);
  const open = newestFirst.find((record) => record.id === openId);

  if (open) {
    return (
      <div className="flex flex-col gap-3">
        {/* One record opened from its own card has no list to go back to. */}
        {newestFirst.length > 1 ? (
          <div>
            <Button
              type="button"
              emphasis="tertiary"
              size="compact"
              onClick={() => setOpenId(null)}
            >
              <RiArrowLeftLine aria-hidden className="h-4 w-4" />
              Back to {newestFirst.length} Records
            </Button>
          </div>
        ) : null}
        <RecordFacts
          record={open}
          dataset={dataset}
          media={media}
          role={role}
          at={request.at}
          inHub={inHub}
        />
      </div>
    );
  }

  if (newestFirst.length === 0) {
    return (
      <EmptyState
        icon={<RiInboxLine className="h-6 w-6" />}
        title="No records"
        description={request.emptyNote ?? "Nothing was submitted here."}
        placement="list"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-(--gg-list-gap)" aria-label={`${request.title} records`}>
        {newestFirst.slice(0, shown).map((record) => {
          const status = statusAt(record, request.at);
          const tone = STATUS_COPY[status].tone;
          return (
            <li key={record.id}>
              <ItemRow
                lead={{
                  kind: "photo",
                  src: media[record.media],
                  mark: record.photoCount > 1 ? record.photoCount : undefined,
                }}
                title={recordTitle(garden, record)}
                status={{ label: STATUS_COPY[status].label, tone }}
                edge={tone}
                details={[
                  accountName(garden, record.accountId),
                  { text: formatMoment(record.submittedAt, locale, garden.timeZone), tone: "soft" },
                ]}
                onOpen={() => setOpenId(record.id)}
              />
            </li>
          );
        })}
      </ul>
      {shown < newestFirst.length ? (
        <div className="flex justify-center">
          <Button
            type="button"
            emphasis="tertiary"
            size="compact"
            onClick={() => setShown(shown + PAGE)}
          >
            Show {Math.min(PAGE, newestFirst.length - shown)} More
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function RecordsDialog({
  request,
  onClose,
  dataset,
  media,
  role,
  tone = "garden",
  inHub = false,
}: RecordsDialogProps) {
  const { locale } = useIntl();
  const counts = request ? countStatuses(request.records, request.at) : null;
  return (
    <AdminDialog
      open={request !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={request?.title ?? ""}
      description={
        request && counts
          ? `${request.records.length > 1 ? `${describeCounts(counts, locale)}. ` : ""}${request.scopeLine}. Times in ${dataset.garden.zoneLabel}.`
          : undefined
      }
      size="lg"
      tone={tone}
    >
      {request ? (
        <RecordsBody
          key={`${request.title}-${request.scopeLine}-${request.openId ?? ""}`}
          request={request}
          dataset={dataset}
          media={media}
          role={role}
          inHub={inHub}
        />
      ) : null}
    </AdminDialog>
  );
}
