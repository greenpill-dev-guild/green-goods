import { Button } from "@green-goods/shared/components/Button";
import { CommitmentRow } from "@green-goods/shared/components/Cards/CommitmentRow/CommitmentRow";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { StatTile } from "@green-goods/shared/components/Cards/StatTile";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { RiCheckLine, RiSeedlingLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { type ReactNode, useEffect, useState } from "react";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import {
  JourneyBand,
  type JourneyStepNote,
  useJourneyEmbed,
} from "../../../../../shared/.storybook/journeyPlayer";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminListRow } from "@/components/AdminListRow";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { directionEdgeClass } from "./poolPresentation";
import { FactValue, VoucherActDialog } from "./VoucherActDialog";

type Tone = "success" | "warning" | "info" | "neutral";
type Act = "approve" | "accept" | "report";

/** One person's booking as the steward reads it: what it waits on and the act it offers. */
interface Booking {
  name: string;
  age: string;
  tag: { label: string; tone: Tone };
  detail: string;
  /** Offered only while the booking waits on the steward. */
  act?: Act;
  /** Decided this visit: the row keeps its place and shows the outcome (DL-067). */
  outcome?: string;
  /** In the queue: it waits on the steward, or was decided this visit. */
  queued: boolean;
  /** The date its dialog names: the deadline to accept, or the day of the visit. */
  date: string;
}

interface ProposedStep extends JourneyStepNote {
  lina: Booking;
  /** Where Lina's own act on this screen leads. */
  leads?: number;
  booked: string;
  reserve: { inReserve: number; booked: number };
}

const lina = (
  tag: Booking["tag"],
  detail: string,
  rest: Partial<Pick<Booking, "act" | "outcome" | "queued" | "age" | "date">> = {}
): Booking => ({
  name: "Lina",
  age: rest.age ?? "2 days ago",
  tag,
  detail,
  act: rest.act,
  outcome: rest.outcome,
  queued: rest.queued ?? true,
  date: rest.date ?? "Jan 20",
});

/**
 * The proposal for the steward: Review Promises is the one queue for every booking that waits
 * on them, Report Visit included, and the list shows each promise once. Fictional data.
 */
export const PROPOSED_HUB_STEPS: readonly ProposedStep[] = [
  {
    caption:
      "Proposed. Everything that waits on you is in Review Promises. The 20 hub days are one row in Offers and Requests.",
    lina: lina(
      { label: "Needs your approval", tone: "warning" },
      "Agreed Jan 13 · 1 voucher · approve by Jan 20",
      { act: "approve" }
    ),
    leads: 1,
    booked: "3 booked",
    reserve: { inReserve: 8, booked: 3 },
  },
  {
    caption:
      "Approved. Lina's row keeps its place with its outcome for this visit, then leaves the queue.",
    next: "Lina deposits her voucher",
    lina: lina({ label: "Waiting for her deposit", tone: "neutral" }, "Accept by Jan 20", {
      outcome: "Approved",
    }),
    booked: "3 booked",
    reserve: { inReserve: 8, booked: 3 },
  },
  {
    caption: "Lina deposited. Her booking is back in the queue, this time to accept.",
    lina: lina({ label: "Deposit confirmed", tone: "info" }, "1 voucher held · accept by Jan 20", {
      act: "accept",
      age: "Today",
    }),
    leads: 3,
    booked: "3 booked",
    reserve: { inReserve: 8, booked: 3 },
  },
  {
    caption:
      "Accepted, and the start went with it, so Lina has no Start step. Your garden paid the message fee.",
    next: "Lina visits the hub",
    lina: lina({ label: "Booked", tone: "success" }, "Visit Jan 22", {
      outcome: "Accepted",
      age: "Today",
    }),
    booked: "3 booked",
    reserve: { inReserve: 8, booked: 3 },
  },
  {
    caption:
      "The visit day has passed. Report Visit sits in the queue with the other acts, not in the list.",
    lina: lina({ label: "Visit to report", tone: "warning" }, "Visited Jan 22 · 1 voucher held", {
      act: "report",
      age: "Jan 22",
      date: "Jan 22",
    }),
    leads: 5,
    booked: "3 booked",
    reserve: { inReserve: 8, booked: 3 },
  },
  {
    caption: "Reported. Nothing moves until Lina confirms her visit.",
    next: "Lina confirms her visit",
    lina: lina({ label: "Waiting for Lina to confirm", tone: "neutral" }, "4 of 4 hours reported", {
      outcome: "Reported",
      age: "Jan 22",
    }),
    booked: "3 booked",
    reserve: { inReserve: 8, booked: 3 },
  },
  {
    caption: "Kept. Lina's voucher is back in your reserve, and her booking has left the queue.",
    lina: lina({ label: "Kept", tone: "success" }, "Confirmed by Lina · Jan 23", {
      queued: false,
      age: "Jan 23",
    }),
    booked: "2 booked · 1 kept",
    reserve: { inReserve: 9, booked: 2 },
  },
];

/** Two neighbors already in the queue, so it shows all three acts from the first screen. */
const OTHERS: readonly (Booking & { done: string })[] = [
  {
    name: "Kwesi",
    age: "3 days ago",
    tag: { label: "Deposit confirmed", tone: "info" },
    detail: "1 voucher held · accept by Jan 19",
    act: "accept",
    queued: true,
    date: "Jan 19",
    done: "Accepted",
  },
  {
    name: "Mara",
    age: "Jan 19",
    tag: { label: "Visit to report", tone: "warning" },
    detail: "Visited Jan 19 · 1 voucher held",
    act: "report",
    queued: true,
    date: "Jan 19",
    done: "Reported",
  },
];

const ACT_LABEL: Record<Act, string> = {
  approve: "Approve…",
  accept: "Accept…",
  report: "Report Visit…",
};

function QueueRow({ booking, onAct }: { booking: Booking; onAct: () => void }) {
  return (
    <li
      className={`grid min-h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2 ps-3 ${directionEdgeClass("OFFER")}`}
      data-component="ProposedQueueRow"
    >
      <AdminListRow className="min-w-0 rounded-[var(--m3-shape-sm)] border-0 bg-transparent px-1 py-0.5">
        <span className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
          <span className="max-w-full shrink-0 truncate type-body text-text-sub">
            {booking.name}
          </span>
          <span className="min-w-0 shrink-[10] truncate type-meta text-text-soft">
            {booking.age}
          </span>
        </span>
        <span className="mt-0.5 block truncate type-meta text-text-sub">
          Hub day, up to 4 hours · 1 voucher
        </span>
      </AdminListRow>
      <div className="flex min-h-7 items-center justify-end gap-1">
        {booking.outcome ? (
          <StatusBadge variant="success" size="sm" icon={<RiCheckLine className="h-3 w-3" />}>
            {booking.outcome}
          </StatusBadge>
        ) : booking.act ? (
          <>
            {booking.act === "report" ? null : (
              <Button type="button" emphasis="tertiary" size="compact">
                Decline…
              </Button>
            )}
            <Button type="button" emphasis="primary" size="compact" onClick={onAct}>
              {ACT_LABEL[booking.act]}
            </Button>
          </>
        ) : null}
      </div>
      <p className="col-span-2 mt-1 flex min-w-0 items-center gap-2 px-1">
        <StatusBadge
          variant={booking.tag.tone}
          size="sm"
          showIcon={false}
          className="shrink-0 whitespace-nowrap"
        >
          {booking.tag.label}
        </StatusBadge>
        <span className="min-w-0 truncate type-meta text-text-soft" title={booking.detail}>
          {booking.detail}
        </span>
      </p>
    </li>
  );
}

const DIALOG: Record<
  Act,
  (
    name: string,
    date: string
  ) => {
    title: string;
    confirm: string;
    note: string;
    facts: readonly { label: string; value: string; note?: string }[];
    line: string;
  }
> = {
  approve: (name, date) => ({
    title: `Approve ${name}’s Booking?`,
    confirm: "Approve Booking",
    note: "Your Safe needs 1 signature.",
    facts: [
      { label: "Vouchers", value: "1 Tech and Sun voucher", note: `From ${name}’s account` },
      { label: "Accept by", value: date },
    ],
    line: `Approving lets ${name} deposit. You accept once the deposit is confirmed.`,
  }),
  accept: (name, date) => ({
    title: `Accept ${name}?`,
    confirm: "Accept and Start",
    note: "Your wallet will ask you to approve.",
    facts: [
      { label: "Deposit", value: "1 voucher, confirmed", note: "Held for this booking" },
      { label: "Accept by", value: date },
    ],
    line: `Accepting also starts the booking, so ${name} has nothing more to do until the visit. Your garden pays the message fee.`,
  }),
  report: (name, date) => ({
    title: `Report ${name}’s Visit`,
    confirm: "Report Visit",
    note: "Your wallet will ask you to approve.",
    facts: [
      { label: "Date", value: date },
      { label: "Usable time", value: "4 of 4 hours" },
      { label: "Evidence", value: "2 photos" },
    ],
    line: `${name} confirms the visit next. Vouchers move only then.`,
  }),
};

function Card({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <AdminCard variant="elevated" className="space-y-3">
      {title}
      {children}
    </AdminCard>
  );
}

/**
 * The Promises tab's three cards a booking touches, as proposed on 18 November 2026 and drawn
 * from the Hub's own parts. The seasons card, Pool Status and Pool Funding are unchanged and
 * left out. A render for review: no Hub component has changed.
 */
function ProposedHubDay({ start }: { start: number }) {
  const count = PROPOSED_HUB_STEPS.length;
  const [index, setIndex] = useState(Math.min(start, count - 1));
  const [asking, setAsking] = useState<{ booking: Booking; own: boolean } | null>(null);
  const [decided, setDecided] = useState<readonly string[]>([]);
  const [listed, setListed] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => setIndex(Math.min(start, count - 1)), [start, count]);
  const embedded = useJourneyEmbed(index, count, setIndex);
  const step = PROPOSED_HUB_STEPS[index]!;
  const others: Booking[] = OTHERS.map((other) =>
    decided.includes(other.name) ? { ...other, act: undefined, outcome: other.done } : other
  );
  const queue = [...(step.lina.queued ? [step.lina] : []), ...others];
  const dialog = asking?.booking.act
    ? DIALOG[asking.booking.act](asking.booking.name, asking.booking.date)
    : null;
  return (
    <div className="min-h-dvh" data-tone="garden" data-workspace="garden">
      {embedded ? null : (
        <JourneyBand
          who="You are Tech and Sun's steward"
          index={index}
          count={count}
          step={step}
          onGo={setIndex}
        />
      )}
      <div className="p-4">
        <div className="garden-tab-layout" data-component="ProposedGardenPoolTab">
          <div className="garden-tab-main">
            <Card
              title={
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <AdminCardTitle>Offers and Requests</AdminCardTitle>
                  <Button
                    type="button"
                    emphasis="secondary"
                    size="compact"
                    leadingIcon={<RiSeedlingLine className="h-4 w-4" aria-hidden="true" />}
                  >
                    Seed Promises
                  </Button>
                </div>
              }
            >
              <AdminSearchToolbar
                search={search}
                onSearchChange={setSearch}
                placeholder="Search promises"
              >
                <div className="flex flex-wrap items-center gap-1.5" role="group">
                  <AdminFilterChip label="Open" selected onToggle={() => undefined} />
                  <AdminFilterChip label="Confirmed" selected={false} onToggle={() => undefined} />
                  <AdminFilterChip label="Past" selected={false} onToggle={() => undefined} />
                </div>
              </AdminSearchToolbar>
              <ul className="space-y-2">
                <li>
                  <CommitmentRow
                    direction="OFFER"
                    title="Hub day, up to 4 hours"
                    status={{ label: "Open", tone: "info" }}
                    units="Takes 1 Tech and Sun voucher"
                    due="due Feb 20"
                    group={{ size: 20, counts: "20 promises" }}
                    amount={{ value: step.booked, caption: "17 of 20 open" }}
                    onOpen={() => setListed(!listed)}
                    openLabel="Show bookings for Hub day, up to 4 hours"
                  />
                  {listed ? (
                    <ul
                      className="ms-[72px] mt-2 divide-y divide-stroke-soft rounded-[var(--gg-row-radius)] border border-stroke-soft px-3"
                      data-component="ProposedBookingList"
                    >
                      {[step.lina, ...others].map((booking) => (
                        <li
                          key={booking.name}
                          className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-2"
                        >
                          <span className="w-16 shrink-0 truncate type-body text-text-strong">
                            {booking.name}
                          </span>
                          <StatusBadge
                            variant={booking.outcome ? "success" : booking.tag.tone}
                            size="sm"
                            showIcon={false}
                          >
                            {booking.outcome ?? booking.tag.label}
                          </StatusBadge>
                          <span className="min-w-0 truncate type-meta text-text-soft">
                            {booking.detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
                <li>
                  <CommitmentRow
                    direction="REQUEST"
                    title="Map the garden’s water lines"
                    status={{ label: "In progress", tone: "info" }}
                    units="Pays 2 Tech and Sun vouchers"
                    due="due Feb 9"
                    amount={{ value: "Lina", caption: "doing this" }}
                    onOpen={() => undefined}
                  />
                </li>
              </ul>
            </Card>
          </div>
          <aside className="garden-tab-rail flex flex-col gap-section">
            <AdminCard variant="elevated" className="space-y-2" data-component="ProposedQueue">
              <div>
                <AdminCardTitle>Review Promises</AdminCardTitle>
                <p className="mt-1 type-body text-text-soft">
                  {queue.some((booking) => booking.act)
                    ? "Everything waiting on you: bookings to approve, deposits to accept and visits to report."
                    : "Nothing to review."}
                </p>
              </div>
              {queue.length > 0 ? (
                <ul className="divide-y divide-stroke-soft">
                  {queue.map((booking) => (
                    <QueueRow
                      key={booking.name}
                      booking={booking}
                      onAct={() => setAsking({ booking, own: booking.name === "Lina" })}
                    />
                  ))}
                </ul>
              ) : null}
            </AdminCard>
            <Card
              title={
                <div>
                  <AdminCardTitle>Your Reserve</AdminCardTitle>
                  <p className="mt-1 type-meta text-text-soft">
                    Vouchers you can send as rewards, kept apart from bookings
                  </p>
                </div>
              }
            >
              <div className="grid grid-cols-3 gap-3">
                <StatTile label="In reserve" value={step.reserve.inReserve} />
                <StatTile label="Promised" value={3} />
                <StatTile label="Booked" value={step.reserve.booked} />
              </div>
              <details className="type-meta text-text-sub" data-component="ProposedReserveDetails">
                <summary className="flex min-h-11 cursor-pointer items-center type-label-sm">
                  Reserve details
                </summary>
                <FactList frame="inset">
                  <FactRow
                    label="Allowance for Riverside Commons"
                    value={
                      <FactValue value="2 left of 4" note="What their promised rewards can draw" />
                    }
                  />
                  <FactRow
                    label="Service terms"
                    value={<FactValue value="Version 2" note="Returns by usable time" />}
                  />
                  <FactRow
                    label="Approvals"
                    value={<FactValue value="Each booking" note="Your Safe, 1 signature" />}
                  />
                  <FactRow
                    label="Issuer cap"
                    value={<FactValue value="20 of 20" note="Published policy, monitored" />}
                  />
                </FactList>
              </details>
            </Card>
          </aside>
        </div>
      </div>
      <VoucherActDialog
        open={dialog !== null}
        onClose={() => setAsking(null)}
        tone="garden"
        title={dialog?.title ?? ""}
        description="Hub day, up to 4 hours"
        confirmLabel={dialog?.confirm ?? ""}
        note={dialog?.note ?? ""}
        act={async () => {
          if (!asking) return;
          if (asking.own) {
            if (step.leads !== undefined) setIndex(step.leads);
          } else {
            setDecided([...decided, asking.booking.name]);
          }
        }}
      >
        {dialog ? (
          <>
            <FactList frame="card">
              {dialog.facts.map((fact) => (
                <FactRow
                  key={fact.label}
                  label={fact.label}
                  value={<FactValue value={fact.value} note={fact.note} />}
                />
              ))}
            </FactList>
            <p className="type-body text-text-sub">{dialog.line}</p>
          </>
        ) : null}
      </VoucherActDialog>
    </div>
  );
}

const meta: Meta<typeof ProposedHubDay> = {
  title: "Admin/Pool/Voucher Hub Day Proposal",
  component: ProposedHubDay,
  parameters: { layout: "fullscreen" },
  decorators: [withAdminIdentity, withSeededQueryClient([...STORYBOOK_ADMIN_SHELL_SEEDS])],
  excludeStories: ["PROPOSED_HUB_STEPS"],
  argTypes: { start: { control: { type: "number", min: 0 } } },
  args: { start: 0 },
};
export default meta;
type Story = StoryObj<typeof ProposedHubDay>;

/** A hub day for the steward: one queue to work from, one row per promise in the list. */
export const HubDay: Story = {};
