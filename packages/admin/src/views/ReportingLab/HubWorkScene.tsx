/**
 * Garden reporting lab, walkthrough (proposed): the Hub's Work tab with how long work has
 * waited in its toolbar. The header, its "waiting over a week" stat, the stage rail, search,
 * the Pending and Approved scopes, sort and the work cards are the shipped Hub's. New here
 * are the waiting chips: each band filters the pending list, and each says its count. Age
 * stays metadata, as the Hub's stat says it (DL-044): no chip takes a warning color.
 */
import { EmptyStateShell } from "@green-goods/shared/components/Canvas/EmptyStateShell";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { buildHubHeaderStats } from "@green-goods/shared/hooks/admin-ui/hub/hub.utils";
import { useMediaQuery } from "@green-goods/shared/hooks/ui/useMediaQuery";
import { RiCheckboxCircleLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminSortSelect } from "@/components/AdminSortSelect";
import { HubWorkCard } from "@/views/Hub/components/HubWorkCard";
import { monthOf } from "./dates";
import { accountName, actionTitle, recordTitle } from "./labCopy";
import { LabCanvas } from "./LabCanvas";
import { labGardens } from "./labShell";
import type { MediaSet, ReportDataset, ViewerRole } from "./model";
import { RecordsDialog, type RecordsRequest } from "./RecordsDialog";
import { type AgeBandId, reviewHealth } from "./reviewHealth";
import { HubFrame } from "./SceneFrames";
import { gardenDomain, toHubWork, waitingOverWeek } from "./sceneData";
import { referenceDay } from "./scope";

/** The walkthrough is a steward's; the records dialog shows them the review action. */
const STEWARD: ViewerRole = "steward";

interface HubWorkSceneProps {
  dataset: ReportDataset;
  media: MediaSet;
  /** The waiting band the list opens filtered to. */
  band?: AgeBandId;
  sort?: "newest" | "oldest";
  /** A record whose dialog the screen opens on. */
  openId?: string;
}

export function HubWorkScene({ dataset, media, band, sort, openId }: HubWorkSceneProps) {
  const { formatMessage } = useIntl();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const at = dataset.reference;
  const health = useMemo(
    () => reviewHealth(dataset, dataset.records, at, monthOf(referenceDay(dataset))),
    [dataset, at]
  );
  const [ageBand, setAgeBand] = useState<AgeBandId | undefined>(band);
  const [order, setOrder] = useState(sort ?? "newest");
  const [search, setSearch] = useState("");
  const recordsRequest = (id: string): RecordsRequest | null => {
    const record = dataset.records.find((item) => item.id === id);
    return record
      ? {
          title: formatMessage({
            id: "app.work.detail.reviewTitle",
            defaultMessage: "Review Work",
          }),
          scopeLine: `${recordTitle(dataset.garden, record)}, from ${accountName(dataset.garden, record.accountId)}`,
          records: [record],
          at,
          openId: record.id,
        }
      : null;
  };
  const [open, setOpen] = useState<RecordsRequest | null>(() =>
    openId ? recordsRequest(openId) : null
  );

  const query = search.trim().toLowerCase();
  const inBand = ageBand
    ? (health.bands.find((item) => item.id === ageBand)?.records ?? [])
    : health.pending;
  const shown = inBand
    .filter(
      (record) =>
        !query ||
        recordTitle(dataset.garden, record).toLowerCase().includes(query) ||
        accountName(dataset.garden, record.accountId).toLowerCase().includes(query)
    )
    .sort((a, b) =>
      order === "newest" ? b.submittedAt - a.submittedAt : a.submittedAt - b.submittedAt
    );

  const toolbar = (
    <AdminSearchToolbar
      search={search}
      onSearchChange={setSearch}
      placeholder={formatMessage({
        id: "cockpit.hub.search.placeholder",
        defaultMessage: "Search submissions",
      })}
    >
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label={formatMessage({ id: "cockpit.hub.work.scope", defaultMessage: "Work status" })}
      >
        <AdminFilterChip
          label={formatMessage({ id: "app.admin.work.filter.pending", defaultMessage: "Pending" })}
          selected
          onToggle={() => setAgeBand(undefined)}
        />
        <AdminFilterChip
          label={formatMessage({
            id: "app.admin.work.filter.approved",
            defaultMessage: "Approved",
          })}
          selected={false}
          onToggle={() => undefined}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Waiting">
        {health.bands.map((item) => (
          <AdminFilterChip
            key={item.id}
            label={`${item.label} · ${item.records.length}`}
            selected={ageBand === item.id}
            disabled={item.records.length === 0}
            onToggle={() => setAgeBand(ageBand === item.id ? undefined : item.id)}
          />
        ))}
      </div>
      <AdminSortSelect
        value={order}
        onChange={(value) => setOrder(value === "oldest" ? "oldest" : "newest")}
        options={[
          {
            value: "newest",
            label: formatMessage({ id: "cockpit.hub.sort.newest", defaultMessage: "Newest" }),
          },
          {
            value: "oldest",
            label: formatMessage({ id: "cockpit.hub.sort.oldest", defaultMessage: "Oldest" }),
          },
        ]}
      />
    </AdminSearchToolbar>
  );

  return (
    <LabCanvas
      workspace="hub"
      gardens={labGardens(media, dataset.garden)}
      gardenId={dataset.garden.id}
    >
      <HubFrame
        stage="work"
        counts={{ work: health.pending.length }}
        stats={buildHubHeaderStats({
          hasSelectedGarden: true,
          waitingOverWeekCount: waitingOverWeek(health),
          formatMessage,
        })}
        toolbar={toolbar}
        resultsLabel={formatMessage({ id: "cockpit.hub.tab.work", defaultMessage: "Work" })}
      >
        {shown.length === 0 ? (
          <EmptyStateShell>
            <EmptyState
              icon={<RiCheckboxCircleLine className="h-6 w-6" />}
              title="Nothing waiting this long"
              description="Choose another waiting time, or clear it to see all pending work."
            />
          </EmptyStateShell>
        ) : (
          <ul
            className="hub-workbench-grid"
            data-card-layout={isDesktop ? "wide" : "stacked"}
            // eslint-disable-next-line jsx-a11y/no-redundant-roles -- hub-workbench-grid drops list semantics with list-style:none and display:grid; the role restores them, as in HubWorkQueue
            role="list"
          >
            {shown.map((record, index) => (
              <li key={record.id} className="min-w-0">
                <HubWorkCard
                  work={toHubWork(record, dataset, media, at)}
                  actionDomain={gardenDomain(dataset)}
                  actionTitle={actionTitle(dataset.garden, record.actionId)}
                  gardenName={dataset.garden.name}
                  gardenerDisplayName={accountName(dataset.garden, record.accountId)}
                  layout={isDesktop ? "wide" : "stacked"}
                  selected={open?.openId === record.id}
                  eagerImages={index < 6}
                  onClick={() => setOpen(recordsRequest(record.id))}
                />
              </li>
            ))}
          </ul>
        )}
      </HubFrame>
      <RecordsDialog
        request={open}
        onClose={() => setOpen(null)}
        dataset={dataset}
        media={media}
        role={STEWARD}
        tone="hub"
        inHub
      />
    </LabCanvas>
  );
}
