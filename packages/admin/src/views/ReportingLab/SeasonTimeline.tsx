/**
 * Garden reporting lab, interface 4: the season timeline. A drawn timeline shows windows,
 * promise deadlines, milestones, planned work and recorded delivery on one axis; the list
 * under it holds the same items as rows that open their detail, so nothing depends on the
 * drawing. A season paces work: the timeline marks today, never a countdown.
 */
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { RiCalendarLine, RiFlagLine, RiHandHeartLine, RiSeedlingLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { AdminDialog } from "@/components/AdminDialog";
import { formatDay, formatShortDay } from "./dates";
import { accountName } from "./labCopy";
import type { PromiseItem, ReportDataset, ReportingWindow, SeasonMilestone } from "./model";
import type { RecordsRequest } from "./RecordsDialog";
import type { ReportScope } from "./scope";
import { linkedWork, type TimelineItem, timelineItems, timelineSpan } from "./timeline";
import { TimelineAxis } from "./TimelineAxis";

interface SeasonTimelineProps {
  dataset: ReportDataset;
  scope: ReportScope;
  onScopeChange: (patch: Partial<ReportScope>) => void;
  onOpenRecords: (request: RecordsRequest) => void;
  /** An item whose detail the screen opens on. */
  openItemId?: string;
}

function iconFor(item: TimelineItem) {
  if (item.kind === "window") return <RiCalendarLine className="h-6 w-6" />;
  if (item.kind === "milestone") return <RiFlagLine className="h-6 w-6" />;
  return (item.source as PromiseItem).direction === "ask" ? (
    <RiHandHeartLine className="h-6 w-6" />
  ) : (
    <RiSeedlingLine className="h-6 w-6" />
  );
}

export function SeasonTimeline({
  dataset,
  scope,
  onScopeChange,
  onOpenRecords,
  openItemId,
}: SeasonTimelineProps) {
  const { locale } = useIntl();
  const [open, setOpen] = useState<TimelineItem | null>(
    () => timelineItems(dataset).find((item) => item.id === openItemId) ?? null
  );
  const { garden } = dataset;
  const items = timelineItems(dataset).filter(
    (item) =>
      scope.windowId === "all" ||
      item.id === scope.windowId ||
      ("windowId" in item.source && item.source.windowId === scope.windowId)
  );
  const span = timelineSpan(timelineItems(dataset), dataset);
  const day = (value: string) =>
    formatDay(value, locale, { month: "short", day: "numeric", year: "numeric" });
  const hasPlanned = garden.actions.some((action) => action.planned);

  if (timelineItems(dataset).length === 0) {
    return (
      <AdminCard>
        <EmptyState
          icon={<RiCalendarLine className="h-6 w-6" />}
          title="No season yet"
          description="A season, its campaigns and its promises appear here once the garden's pool opens one."
        />
      </AdminCard>
    );
  }

  const detail = (item: TimelineItem) => {
    if (item.kind === "window") {
      const window = item.source as ReportingWindow;
      return (
        <FactList frame="inset">
          <FactRow label="Kind" value={window.kind === "season" ? "Season" : "Campaign"} />
          <FactRow label="Dates" value={`${day(window.start)} to ${day(window.end)}`} />
          <FactRow
            label="Promises"
            value={`${garden.promises.filter((p) => p.windowId === window.id).length}`}
          />
          <FactRow
            label="Reports"
            action={
              <Button
                type="button"
                size="compact"
                emphasis="secondary"
                onClick={() => {
                  setOpen(null);
                  onScopeChange({ windowId: window.id, view: "calendar" });
                }}
              >
                Show in Calendar
              </Button>
            }
          />
        </FactList>
      );
    }
    if (item.kind === "promise") {
      const promise = item.source as PromiseItem;
      const linked = linkedWork(dataset, promise);
      return (
        <FactList frame="inset">
          <FactRow label="Direction" value={promise.direction === "offer" ? "Offer" : "Ask"} />
          <FactRow label="Lead" value={accountName(garden, promise.leadId)} />
          <FactRow label="Due" value={day(promise.due)} />
          <FactRow label="Done" value={promise.doneOn ? day(promise.doneOn) : "Not yet"} />
          <FactRow
            label="Linked work"
            description="Matched by action and date in this lab; production would read the promise's own evidence links."
            value={
              promise.actionId
                ? `${linked.length} records of its action in its window`
                : "This promise links no work"
            }
            action={
              linked.length > 0 ? (
                <Button
                  type="button"
                  size="compact"
                  emphasis="secondary"
                  onClick={() => {
                    setOpen(null);
                    onOpenRecords({
                      title: promise.title,
                      scopeLine: `Linked work up to ${day(promise.due)}`,
                      records: linked,
                      at: dataset.reference,
                    });
                  }}
                >
                  Open
                </Button>
              ) : undefined
            }
          />
        </FactList>
      );
    }
    const milestone = item.source as SeasonMilestone;
    return (
      <FactList frame="inset">
        <FactRow label="Date" value={day(milestone.on)} />
        <FactRow
          label="Kind"
          value={
            milestone.kind === "assessment"
              ? "Baseline assessment"
              : milestone.kind === "report"
                ? "Report"
                : "Check-in"
          }
        />
        <FactRow
          label="Recorded"
          value={
            milestone.proposed
              ? "Proposed: seasons hold no milestones today"
              : "Yes, as an assessment"
          }
        />
      </FactList>
    );
  };

  return (
    <AdminCard density="none" data-component="SeasonTimeline">
      <AdminCardHeader className="flex-wrap gap-3">
        <div className="min-w-0">
          <AdminCardTitle as="h2">
            {formatShortDay(span.start, locale)} to {formatShortDay(span.end, locale)}
          </AdminCardTitle>
          <p className="mt-1 type-body text-text-sub">
            Planned work and recorded delivery are separate lanes. The shaded band is the selected
            month; the line is today.
          </p>
        </div>
      </AdminCardHeader>
      <AdminCardBody className="flex flex-col gap-5">
        <TimelineAxis
          dataset={dataset}
          items={items}
          span={span}
          month={scope.month}
          locale={locale}
        />
        <p className="type-meta text-text-sub">
          {hasPlanned
            ? "Planned work counts published sessions; recorded delivery counts every other record, whatever its status."
            : "This garden plans through promises, so the planned lane is empty; recorded delivery counts every record, whatever its status."}
        </p>
        <ul aria-label="Timeline items" className="flex flex-col gap-(--gg-list-gap)">
          {items.map((item) => (
            <li key={item.id}>
              <ItemRow
                lead={{
                  kind: "icon",
                  icon: iconFor(item),
                  label:
                    item.kind === "promise"
                      ? `${(item.source as PromiseItem).direction} promise`
                      : undefined,
                }}
                title={item.title}
                status={item.pill}
                edge={item.pill.tone}
                details={[
                  item.kind === "window"
                    ? `${day(item.start)} to ${day(item.end)}`
                    : `${item.kind === "promise" ? "Due" : "On"} ${day(item.start)}`,
                  item.kind === "promise"
                    ? accountName(garden, (item.source as PromiseItem).leadId)
                    : item.kind === "window"
                      ? (item.source as ReportingWindow).kind === "season"
                        ? "Season"
                        : "Campaign"
                      : "Milestone",
                ]}
                onOpen={() => setOpen(item)}
              />
            </li>
          ))}
        </ul>
      </AdminCardBody>
      <AdminDialog
        open={open !== null}
        onOpenChange={(next) => !next && setOpen(null)}
        title={open?.title ?? ""}
        description={open ? open.pill.label : undefined}
        size="md"
        tone="garden"
      >
        {open ? detail(open) : null}
      </AdminDialog>
    </AdminCard>
  );
}
