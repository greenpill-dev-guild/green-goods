import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { SheetHeading } from "@green-goods/shared/components/Dialog/SheetHeading";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import {
  RiCalendarCheckLine,
  RiCheckLine,
  RiCheckboxBlankCircleLine,
  RiCoupon3Line,
  RiGiftLine,
  RiStore2Line,
  RiTimeLine,
} from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { type ReactNode, useEffect, useState } from "react";
import {
  type JourneyStepNote,
  useJourneyEmbed,
} from "../../../../../../shared/.storybook/journeyPlayer";
import { FormProgress } from "@/components/Communication";
import { TopNav } from "@/components/Navigation";
import { FixedBar } from "../FixedBar";

/** The four markers a booking shows, in the tracker Submit Work uses. */
const MARKERS = ["Request", "Deposit", "Visit", "Done"];

type SheetId = "book" | "deposit" | "confirm" | "split";

interface ProposedStep extends JourneyStepNote {
  /** The current marker, 1 to 4; 5 once every marker is done. */
  at: 1 | 2 | 3 | 4 | 5;
  /** Who the current marker waits on, when it is not the member's own step. */
  waiting?: string;
  pill: { label: string; tone: "info" | "neutral" | "warning" | "success" };
  band: "neutral" | "attention" | "kept";
  needsYou?: boolean;
  sentence: string;
  voucher: { label: string; value: string; detail?: string };
  acceptBy?: string;
  reported?: string;
  /** How many of the detailed steps are done; the one after is under way. */
  done: number;
  primary?: { label: string; sheet: SheetId; leads: number };
  secondary?: string;
}

const HELD = { label: "Your voucher", value: "Held for this booking" };

/**
 * The proposal: three moments for the member (Book, Deposit, Confirm your visit), with every
 * wait told in the status and the tracker's clock. Fictional data; nothing is signed or sent.
 */
export const PROPOSED_HUB_DAY_STEPS: readonly ProposedStep[] = [
  {
    caption:
      "Proposed. Lina opened the hub day from the garden's list. One status, three facts, one button.",
    at: 1,
    pill: { label: "Open to book", tone: "info" },
    band: "neutral",
    sentence: "Booking takes 1 Tech and Sun voucher. Nothing moves until you agree to the terms.",
    voucher: { label: "It takes", value: "1 Tech and Sun voucher", detail: "You hold 9." },
    done: 0,
    primary: { label: "Book", sheet: "book", leads: 1 },
  },
  {
    caption:
      "Moment 1 done. The tracker's clock says the next step waits on Tech and Sun, not on Lina.",
    next: "Tech and Sun approves",
    at: 2,
    waiting: "waiting on Tech and Sun",
    pill: { label: "Waiting for approval", tone: "neutral" },
    band: "neutral",
    sentence:
      "Tech and Sun approves your request next. Nothing has left your account. You'll get a notice when it's your turn.",
    voucher: { label: "Your voucher", value: "Still in your account" },
    acceptBy: "Jan 20",
    done: 1,
    secondary: "Cancel Booking",
  },
  {
    caption: "Moment 2. A notice brought Lina back: the marker is filled because the step is hers.",
    at: 2,
    pill: { label: "Deposit due", tone: "warning" },
    band: "attention",
    needsYou: true,
    sentence:
      "Tech and Sun approved. Deposit your voucher to hold your place. Tech and Sun accepts by Jan 20.",
    voucher: { label: "Your voucher", value: "Still in your account" },
    acceptBy: "Jan 20",
    done: 2,
    primary: { label: "Deposit 1 Voucher", sheet: "deposit", leads: 3 },
    secondary: "Cancel Booking",
  },
  {
    caption:
      "Deposited. The deposit's confirmation and the steward's acceptance are one wait to Lina.",
    next: "Tech and Sun accepts",
    at: 3,
    waiting: "waiting on Tech and Sun",
    pill: { label: "Waiting to be accepted", tone: "neutral" },
    band: "neutral",
    sentence:
      "Your voucher is held for this booking. Tech and Sun accepts by Jan 20. Until then you can cancel and get it back.",
    voucher: HELD,
    acceptBy: "Jan 20",
    done: 4,
    secondary: "Cancel Booking",
  },
  {
    caption:
      "Accepted. The steward's Accept also sent the start, so Lina has no Start the Booking step. The cross-chain wait is a sentence, not a task.",
    next: "The booking is confirmed",
    at: 3,
    waiting: "being confirmed",
    pill: { label: "Accepted", tone: "info" },
    band: "neutral",
    sentence:
      "Tech and Sun accepted you. Your booking is being confirmed, which can take 20 minutes or longer. There's nothing for you to do.",
    voucher: HELD,
    done: 5,
  },
  {
    caption: "Booked. The Visit marker is Lina's: she goes to the hub.",
    next: "Tech and Sun reports the visit",
    at: 3,
    pill: { label: "Booked", tone: "success" },
    band: "neutral",
    sentence:
      "You're booked for a hub day at Tech and Sun. After your visit, come back here to confirm it.",
    voucher: HELD,
    done: 6,
    secondary: "Report a Problem",
  },
  {
    caption:
      "Moment 3. One sheet closes the booking: the split, its transfer and 'kept' run in order.",
    at: 4,
    pill: { label: "Visit reported", tone: "warning" },
    band: "attention",
    needsYou: true,
    sentence:
      "Tech and Sun reported your visit: 4 of 4 hours on Jan 22. Confirm it to close your booking.",
    voucher: HELD,
    reported: "4 of 4 hours · Jan 22",
    done: 7,
    primary: { label: "Confirm Your Visit", sheet: "confirm", leads: 7 },
    secondary: "Report a Problem",
  },
  {
    caption: "Done. Every marker is ticked and the page says where the voucher went.",
    at: 5,
    pill: { label: "Kept", tone: "success" },
    band: "kept",
    sentence: "You confirmed your hub day, and your voucher went to Tech and Sun's reserve.",
    voucher: { label: "Your voucher", value: "Went to Tech and Sun's reserve" },
    reported: "4 of 4 hours · Jan 22",
    done: 9,
  },
  {
    caption:
      "Side state. A visit cut short: the same Confirm button, and its sheet shows the split first.",
    at: 4,
    pill: { label: "Visit reported", tone: "warning" },
    band: "attention",
    needsYou: true,
    sentence:
      "Tech and Sun reported 2 of 4 hours on Jan 22 and proposes half your voucher back. Check the split, then confirm.",
    voucher: HELD,
    reported: "2 of 4 hours · Jan 22",
    done: 7,
    primary: { label: "Confirm Your Visit", sheet: "split", leads: 9 },
    secondary: "Report a Problem",
  },
  {
    caption: "Side state. Closed with a return: half a voucher is back with Lina.",
    at: 5,
    pill: { label: "Kept", tone: "success" },
    band: "kept",
    sentence:
      "You confirmed your hub day. Half a voucher came back to you, and half went to Tech and Sun's reserve.",
    voucher: { label: "Your voucher", value: "0.5 back to you · 0.5 to Tech and Sun's reserve" },
    reported: "2 of 4 hours · Jan 22",
    done: 9,
  },
];

/** The detail today's page shows as 12 steps and a History, behind one disclosure. */
const DETAIL_STEPS = [
  "You agreed to the terms and sent your request",
  "Tech and Sun approved it",
  "You deposited your voucher",
  "Deposit confirmed",
  "Tech and Sun accepted you",
  "Booking confirmed on the voucher network",
  "Tech and Sun reported your visit",
  "You confirmed your visit",
  "Your voucher reached its destination",
];

const BAND_CLASS = {
  neutral: "border-stroke-soft-200 bg-bg-weak-50",
  attention: "border-warning-light bg-warning-lighter",
  kept: "border-success-light bg-success-lighter",
} as const;

function Fact({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <FactRow
      icon={icon}
      label={label}
      value={
        <>
          {value}
          {detail ? (
            <span className="mt-0.5 block text-xs font-normal leading-4 text-text-sub-600">
              {detail}
            </span>
          ) : null}
        </>
      }
    />
  );
}

function BookingDetails({ step }: { step: ProposedStep }) {
  return (
    <details className="mt-3 text-xs text-text-sub-600" data-component="BookingDetails">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium">
        {step.done === 0 ? "How booking works" : "Booking details"}
      </summary>
      <ol className="space-y-1.5 pb-2">
        {DETAIL_STEPS.map((text, at) => {
          const state = at < step.done ? "Done" : at === step.done ? "Now" : "Later";
          return (
            <li
              key={text}
              className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-1.5 leading-4 text-text-strong-950"
            >
              <span
                className={
                  state === "Done"
                    ? "text-success-base"
                    : state === "Now"
                      ? "text-information-dark"
                      : "text-text-soft-400"
                }
              >
                {state === "Done" ? (
                  <RiCheckLine className="h-3.5 w-3.5" aria-hidden="true" />
                ) : state === "Now" ? (
                  <RiTimeLine className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <RiCheckboxBlankCircleLine className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0">{text}</span>
              <span className="whitespace-nowrap text-[11px] font-semibold text-text-sub-600">
                {step.done === 0 ? "" : state}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="pb-1">
        Terms version 2. If a visit is cut short, vouchers come back by usable time and you approve
        the split. The promise is recorded on Arbitrum and the voucher is held on Gnosis.
      </p>
    </details>
  );
}

const SHEETS: Record<
  SheetId,
  {
    title: string;
    at: 1 | 2 | 4;
    heading: string;
    facts: readonly { label: string; value: string; detail?: string }[];
    note: string;
    confirm: string;
    cancel: string;
  }
> = {
  book: {
    title: "Book a Hub Day",
    at: 1,
    heading: "Agree to the terms",
    facts: [
      { label: "You get", value: "One visit, up to 4 hours" },
      {
        label: "You give",
        value: "1 Tech and Sun voucher",
        detail: "You deposit it after Tech and Sun approves.",
      },
      {
        label: "If it's cut short",
        value: "Vouchers come back by usable time",
        detail: "You approve the split.",
      },
    ],
    note: "Your passkey asks you to approve. Nothing leaves your account yet.",
    confirm: "Agree and Book",
    cancel: "Cancel",
  },
  deposit: {
    title: "Deposit Your Voucher",
    at: 2,
    heading: "Hold your place",
    facts: [
      { label: "Deposit", value: "1 Tech and Sun voucher", detail: "From your account" },
      {
        label: "Held",
        value: "For this booking",
        detail: "Tech and Sun can't use it until you confirm your visit.",
      },
      { label: "Accept by", value: "Jan 20", detail: "Cancel before then and it comes back." },
    ],
    note: "Your passkey asks you to approve.",
    confirm: "Deposit 1 Voucher",
    cancel: "Cancel",
  },
  confirm: {
    title: "Confirm Your Visit",
    at: 4,
    heading: "Did your hub day happen?",
    facts: [
      { label: "Reported", value: "4 of 4 hours", detail: "By Tech and Sun, for Jan 22" },
      { label: "Your voucher", value: "1 goes to Tech and Sun's reserve" },
    ],
    note: "This closes your booking. Your passkey may ask twice, once on each network.",
    confirm: "Yes, Confirm My Visit",
    cancel: "Report a Problem",
  },
  split: {
    title: "Confirm Your Visit",
    at: 4,
    heading: "Your visit was cut short",
    facts: [
      { label: "Reported", value: "2 of 4 hours", detail: "By Tech and Sun, for Jan 22" },
      { label: "Back to you", value: "0.5 voucher", detail: "For the 2 hours you didn't get" },
      { label: "To Tech and Sun", value: "0.5 voucher", detail: "For the 2 hours you used" },
    ],
    note: "Tech and Sun proposed this split within its terms. Your passkey may ask twice, once on each network.",
    confirm: "Approve Split and Confirm",
    cancel: "Report a Problem",
  },
};

/**
 * The hub-day booking as proposed on 18 November 2026, drawn from the app's own parts (the top
 * bar and its tracker, fact rows, the sheet, the fixed bar) so the look is the shipping one.
 * The page and its sheets are a render for review: no booking component has changed.
 */
function ProposedHubDay({ start }: { start: number }) {
  const count = PROPOSED_HUB_DAY_STEPS.length;
  const [index, setIndex] = useState(Math.min(start, count - 1));
  // The sheet keeps its last content while it closes, so it never slides away empty.
  const [sheet, setSheet] = useState<SheetId>("book");
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    setIndex(Math.min(start, count - 1));
    setSheetOpen(false);
  }, [start, count]);
  const go = (target: number) => {
    setSheetOpen(false);
    setIndex(target);
  };
  const show = (id: SheetId) => {
    setSheet(id);
    setSheetOpen(true);
  };
  const embedded = useJourneyEmbed(index, count, go);
  const step = PROPOSED_HUB_DAY_STEPS[index]!;
  const open = SHEETS[sheet];
  // Where the open sheet's confirm leads: the step that opened it names the target.
  const [leads, setLeads] = useState(0);
  return (
    <div className="flex min-h-dvh flex-col bg-bg-white-0 text-text-strong-950">
      {embedded ? null : (
        <div className="sticky top-0 z-50 border-b border-stroke-soft-200 bg-bg-weak-50 p-3 text-xs">
          <p className="font-semibold text-text-sub-600">
            Step {index + 1} of {count}
          </p>
          <p className="mt-0.5 text-sm text-text-strong-950">{step.caption}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="compact"
              emphasis="secondary"
              disabled={index === 0}
              onClick={() => go(index - 1)}
            >
              Back
            </Button>
            {step.next ? (
              <Button type="button" size="compact" onClick={() => go(index + 1)}>
                {step.next}
              </Button>
            ) : null}
          </div>
        </div>
      )}
      <div className="w-full" data-component="ProposedBookingPage">
        <TopNav onBackClick={() => undefined} overlay={embedded}>
          <FormProgress currentStep={step.at} steps={MARKERS} waiting={step.waiting} />
        </TopNav>
        <div
          className={embedded ? "space-y-4 p-4 pt-[var(--app-top-bar-height)]" : "space-y-4 p-4"}
        >
          <h1 className="text-lg font-medium leading-7 text-text-strong-950">
            Hub day, up to 4 hours
          </h1>
          <section
            className={`rounded-[var(--radius-lg)] border p-4 ${BAND_CLASS[step.band]}`}
            aria-label="Status"
            data-component="ProposedStatusBand"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge size="sm" variant={step.pill.tone} showIcon={false}>
                {step.pill.label}
              </StatusBadge>
              {step.needsYou ? (
                <span className="text-xs font-medium text-warning-dark">Needs you</span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-text-strong-950">{step.sentence}</p>
          </section>
          <section className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4">
            {step.done === 0 ? (
              <p className="text-sm leading-relaxed text-text-sub-600">
                A reserved visit to the Tech and Sun hub for one named person, with workspace, power
                and connectivity for up to four hours.
              </p>
            ) : null}
            <FactList frame="inset" className={step.done === 0 ? "mt-1" : undefined}>
              <Fact
                icon={<RiGiftLine />}
                label={step.at === 5 ? "You got" : "You get"}
                value="One visit, up to 4 hours"
                detail={step.done === 0 ? "In your name." : undefined}
              />
              <Fact icon={<RiCoupon3Line />} {...step.voucher} />
              {step.done === 0 ? (
                <Fact icon={<RiStore2Line />} label="Offered by" value="Tech and Sun" />
              ) : null}
              {step.acceptBy ? (
                <Fact icon={<RiTimeLine />} label="Accept by" value={step.acceptBy} />
              ) : null}
              {step.reported ? (
                <Fact icon={<RiCalendarCheckLine />} label="Reported" value={step.reported} />
              ) : null}
            </FactList>
            <BookingDetails step={step} />
          </section>
        </div>
        {step.primary || step.secondary ? (
          <FixedBar>
            <div className="shrink-0 border-t border-stroke-soft-200 bg-bg-white-0 p-4 pb-[max(1rem,var(--safe-area-bottom))]">
              <div className="flex flex-row-reverse flex-wrap gap-2">
                {step.primary ? (
                  <Button
                    type="button"
                    size="lg"
                    className={
                      step.secondary ? "min-w-max grow basis-[calc(50%-0.25rem)]" : "w-full"
                    }
                    onClick={() => {
                      setLeads(step.primary!.leads);
                      show(step.primary!.sheet);
                    }}
                  >
                    {step.primary.label}
                  </Button>
                ) : null}
                {step.secondary ? (
                  <Button
                    type="button"
                    size="lg"
                    emphasis="secondary"
                    className={step.primary ? "min-w-max grow basis-[calc(50%-0.25rem)]" : "w-full"}
                  >
                    {step.secondary}
                  </Button>
                ) : null}
              </div>
            </div>
          </FixedBar>
        ) : null}
      </div>
      <DialogShell
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={open.title}
        size="md"
        sheetSize="tall"
        actions={{
          primary: { label: open.confirm, onClick: () => go(leads) },
          secondary: { label: open.cancel, onClick: () => setSheetOpen(false) },
        }}
      >
        <div className="space-y-4" data-component="ProposedBookingSheet">
          <FormProgress currentStep={open.at} steps={MARKERS} />
          <SheetHeading>{open.heading}</SheetHeading>
          <FactList frame="inset">
            {open.facts.map((fact) => (
              <FactRow
                key={fact.label}
                label={fact.label}
                value={
                  <>
                    {fact.value}
                    {fact.detail ? (
                      <span className="mt-0.5 block text-xs font-normal leading-4 text-text-sub-600">
                        {fact.detail}
                      </span>
                    ) : null}
                  </>
                }
              />
            ))}
          </FactList>
          <p className="text-xs text-text-sub-600">{open.note}</p>
        </div>
      </DialogShell>
    </div>
  );
}

const meta: Meta<typeof ProposedHubDay> = {
  title: "Client/Commitments/Voucher Hub Day Proposal",
  component: ProposedHubDay,
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  excludeStories: ["PROPOSED_HUB_DAY_STEPS"],
  argTypes: { start: { control: { type: "number", min: 0 } } },
  args: { start: 0 },
};
export default meta;
type Story = StoryObj<typeof ProposedHubDay>;

/** A hub day in three moments for the member: Book, Deposit, Confirm your visit. */
export const HubDay: Story = {};
