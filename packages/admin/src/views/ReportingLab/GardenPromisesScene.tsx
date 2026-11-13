/**
 * Garden reporting lab, walkthrough (proposed): Garden's Promises tab with the season drawn
 * as a timeline. The tab's split and its cards follow `views/Garden/Pool`: What needs you,
 * Offers and Asks, Review Promises and Pool Status, here built from the lab's sample
 * promises because the shipped cards read the pool from chain. New here is the timeline in
 * the season card's place: windows, deadlines, milestones, and planned against recorded
 * work, with each promise opening the work it links.
 */
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { StatTile } from "@green-goods/shared/components/Cards/StatTile";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { RiHandCoinLine, RiHandHeartLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { formatDay } from "./dates";
import { GardenScene } from "./GardenScene";
import type { MediaSet, PromiseItem, ReportDataset } from "./model";
import { referenceDay } from "./scope";
import { SeasonTimeline } from "./SeasonTimeline";
import type { ItemTone } from "./timeline";

type PromiseFilter = "open" | "confirmed" | "pastDue";

function promiseState(item: PromiseItem, today: string): PromiseFilter {
  if (item.doneOn) return "confirmed";
  return item.due < today ? "pastDue" : "open";
}

const PILL: Record<PromiseFilter, { tone: ItemTone }> = {
  open: { tone: "neutral" },
  confirmed: { tone: "success" },
  pastDue: { tone: "error" },
};

interface GardenPromisesSceneProps {
  dataset: ReportDataset;
  media: MediaSet;
  /** A timeline item whose detail the screen opens on. */
  openItemId?: string;
}

export function GardenPromisesScene({ dataset, media, openItemId }: GardenPromisesSceneProps) {
  const { formatMessage, locale } = useIntl();
  const { garden } = dataset;
  const today = referenceDay(dataset);
  const [filter, setFilter] = useState<PromiseFilter>("open");
  const states = garden.promises.map((item) => ({ item, state: promiseState(item, today) }));
  const count = (state: PromiseFilter) => states.filter((entry) => entry.state === state).length;
  const season = garden.windows.find((window) => window.kind === "season");
  const due = (day: string) => formatDay(day, locale, { month: "short", day: "numeric" });

  return (
    <GardenScene dataset={dataset} media={media} view="pool">
      {({ scope, setScope, openRecords }) => (
        <div className="garden-tab-layout">
          <div className="garden-tab-main">
            <AdminCard density="none">
              <AdminCardHeader>
                <AdminCardTitle>
                  {formatMessage({ id: "cockpit.garden.pool.summary.label" })}
                </AdminCardTitle>
              </AdminCardHeader>
              <AdminCardBody>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <StatTile
                    label={formatMessage({ id: "cockpit.garden.pool.summary.waiting" })}
                    value="0"
                  />
                  <StatTile
                    label={formatMessage({ id: "cockpit.garden.pool.summary.recovery" })}
                    value="0"
                  />
                  <StatTile
                    label={formatMessage({ id: "cockpit.garden.pool.summary.pastDue" })}
                    value={String(count("pastDue"))}
                  />
                </div>
              </AdminCardBody>
            </AdminCard>
            <SeasonTimeline
              dataset={dataset}
              scope={scope}
              onScopeChange={setScope}
              onOpenRecords={openRecords}
              openItemId={openItemId}
            />
            <AdminCard density="none" data-component="PoolCommitmentsMirror">
              <AdminCardHeader className="flex-wrap gap-3">
                <AdminCardTitle>
                  {formatMessage({ id: "cockpit.garden.pool.promises.title" })}
                </AdminCardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminFilterChip
                    label="Open"
                    selected={filter === "open"}
                    onToggle={() => setFilter("open")}
                  />
                  <AdminFilterChip
                    label="Confirmed"
                    selected={filter === "confirmed"}
                    onToggle={() => setFilter("confirmed")}
                  />
                  <AdminFilterChip
                    label={`Past due (${count("pastDue")})`}
                    selected={filter === "pastDue"}
                    onToggle={() => setFilter("pastDue")}
                  />
                </div>
              </AdminCardHeader>
              <AdminCardBody>
                <ul className="flex flex-col gap-(--gg-list-gap)">
                  {states
                    .filter((entry) => entry.state === filter)
                    .map(({ item, state }) => (
                      <li key={item.id}>
                        <ItemRow
                          lead={{
                            kind: "icon",
                            icon:
                              item.direction === "ask" ? <RiHandHeartLine /> : <RiHandCoinLine />,
                          }}
                          title={item.title}
                          status={{
                            label:
                              state === "pastDue"
                                ? formatMessage({ id: "cockpit.garden.pool.row.pastDue" })
                                : state === "confirmed"
                                  ? "Kept"
                                  : item.direction === "ask"
                                    ? "Asked"
                                    : "Offered",
                            tone: PILL[state].tone,
                          }}
                          details={[`due ${due(item.due)}`]}
                        />
                      </li>
                    ))}
                </ul>
              </AdminCardBody>
            </AdminCard>
          </div>
          <aside className="garden-tab-rail flex flex-col gap-section">
            <AdminCard density="none">
              <AdminCardHeader>
                <AdminCardTitle>
                  {formatMessage({ id: "cockpit.garden.pool.approvals.title" })}
                </AdminCardTitle>
              </AdminCardHeader>
              <AdminCardBody>
                <p className="type-body text-text-sub">
                  {formatMessage({ id: "cockpit.garden.pool.approvals.empty" })}
                </p>
              </AdminCardBody>
            </AdminCard>
            <AdminCard density="none">
              <AdminCardHeader className="flex-wrap gap-3">
                <AdminCardTitle>
                  {formatMessage({ id: "cockpit.garden.pool.status.title" })}
                </AdminCardTitle>
                <StatusBadge variant="success">
                  {formatMessage({ id: "cockpit.garden.pool.status.open" })}
                </StatusBadge>
              </AdminCardHeader>
              <AdminCardBody>
                <FactList frame="inset">
                  <FactRow
                    label="Season"
                    value={season ? `${season.name}, through ${due(season.end)}` : "None running"}
                  />
                  <FactRow
                    label="Promises"
                    value={`${garden.promises.length} made, ${count("confirmed")} kept`}
                  />
                </FactList>
              </AdminCardBody>
            </AdminCard>
          </aside>
        </div>
      )}
    </GardenScene>
  );
}
