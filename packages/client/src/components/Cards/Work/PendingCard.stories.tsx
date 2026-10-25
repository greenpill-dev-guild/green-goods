import enMessages from "@green-goods/shared/i18n/en.json";
import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider, useIntl } from "react-intl";
import { expect, fn, within } from "storybook/test";
import { FIXTURE_WORK_MEDIA } from "../../../../../shared/.storybook/fixtures";
import { expectItemRowsFit } from "../../../../../shared/.storybook/itemRowFit";
import { PendingCard, type PendingCardProps } from "./PendingCard";
import { formatAgo, formatRowDay, formatSavedMeta } from "./pendingCopy";

const discard = { onDiscard: fn(), discardLabel: "Discard Compost Turn" };

/** One row of each kind Your Work › Pending holds, as the frames draw them. */
const KINDS: Record<string, PendingCardProps> = {
  blocked: {
    kind: "needs",
    pill: "Can't upload",
    title: "Seed Library Count",
    meta: "Saved Oct 4 · 6:12 PM",
    status: "Action ended",
    statusTone: "error",
    thumbnailUrl: FIXTURE_WORK_MEDIA[0],
    ...discard,
  },
  toUpload: {
    kind: "upload",
    pill: "To upload",
    title: "Compost Turn",
    meta: "Saved today · 9:40 AM",
    status: "Nothing sent yet",
    thumbnailUrl: FIXTURE_WORK_MEDIA[1],
    ...discard,
  },
  forAPromise: {
    kind: "upload",
    pill: "To upload",
    title: "Herb Spiral Weeding",
    meta: "Saved today · 8:05 AM",
    marker: { kind: "linked", label: "For a promise" },
    status: "A photo is still converting",
    thumbnailUrl: FIXTURE_WORK_MEDIA[2],
    discardLabel: "Discard Herb Spiral Weeding",
  },
  proof: {
    kind: "upload",
    pill: "To upload",
    title: "Repair the north fence panel by the compost bays before the first frost",
    meta: "Saved today · 10:24 AM",
    marker: { kind: "proof", label: "Proof" },
    status: "Nothing sent yet",
    thumbnailUrl: FIXTURE_WORK_MEDIA[3],
    ...discard,
  },
  draft: {
    kind: "draft",
    pill: "Draft",
    title: "Mulching",
    meta: "2 hr. ago",
    status: "Step 2 of 4 · 3 photos",
    ...discard,
  },
  checking: {
    kind: "checking",
    pill: "Checking",
    title: "Path Edging",
    meta: "Saved today · 7:58 AM",
    status: "Checking whether it was sent",
    locked: true,
    thumbnailUrl: FIXTURE_WORK_MEDIA[3],
    discardLabel: "Discard Path Edging",
  },
  inReview: {
    kind: "review",
    pill: "In review",
    title: "Mulch Delivery Log",
    meta: "You submitted · Oct 2",
    status: "Waiting for a review",
    thumbnailUrl: FIXTURE_WORK_MEDIA[2],
    discardLabel: "Discard Mulch Delivery Log",
  },
};

/**
 * One row of Your Work › Pending (D12, D13, D20) on the shared item row (F7): the
 * 88px frame for every kind, the pill under the title, where it stands and when on
 * one detail line, and the guarded Discard in the right slot. A promise's mark sits
 * on the photo. The status edge marks blocked work in error, work to upload and
 * anything being checked in information, and work in review in stroke.
 */
const meta: Meta<typeof PendingCard> = {
  title: "Client/Cards/PendingCard",
  component: PendingCard,
  tags: ["autodocs", "storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  args: { onOpen: fn() },
};

export default meta;
type Story = StoryObj<typeof PendingCard>;

export const Blocked: Story = {
  args: KINDS.blocked,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pill = canvas.getByRole("status");
    expect(pill).toHaveTextContent("Can't upload");
    // The status pill, 22px tall (D21), at the 11px size both surfaces share.
    expect(pill.getBoundingClientRect().height).toBeCloseTo(22, 0);
    expect(canvas.getByRole("button", { name: "Discard Compost Turn" })).toBeInTheDocument();
    await expectItemRowsFit(canvasElement);
  },
};

export const ToUpload: Story = { args: KINDS.toUpload };

export const ForAPromise: Story = { args: KINDS.forAPromise };

export const Proof: Story = { args: KINDS.proof };

export const Draft: Story = { args: KINDS.draft };

/** Nothing can be done to it while a send may be on its way: no Discard. */
export const Checking: Story = {
  args: KINDS.checking,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByRole("button", { name: "Discard Path Edging" })).toBeNull();
  },
};

export const InReview: Story = { args: KINDS.inReview };

/** Every kind in the list's order: one height, 12px apart. */
export const EveryKind: Story = {
  render: () => (
    <ul className="flex flex-col gap-(--gg-list-gap)">
      {Object.entries(KINDS).map(([name, props]) => (
        <li key={name}>
          <PendingCard {...props} onOpen={fn()} />
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    await expectItemRowsFit(canvasElement);
  },
};

const CATALOGS = { en: enMessages, es: esMessages, pt: ptMessages } as const;

/** Each kind with the list's longest real words, in the reader's language. */
function LocalizedKinds() {
  const intl = useIntl();
  const text = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  // The rows' own formatters, so each language gets its own clock and short age.
  const now = Date.now();
  const saved = formatSavedMeta(intl, new Date(now).setHours(9, 40, 0, 0));
  const rows: PendingCardProps[] = [
    { ...KINDS.blocked, pill: text("app.pending.pill.cantUpload"), meta: saved },
    {
      ...KINDS.toUpload,
      pill: text("app.uploads.chip.toUpload"),
      meta: saved,
      status: text("app.pending.status.uploadsWhenConnected"),
    },
    {
      ...KINDS.proof,
      pill: text("app.uploads.chip.toUpload"),
      meta: saved,
      status: text("app.pending.status.sendItWhenConnected"),
    },
    {
      ...KINDS.draft,
      pill: text("app.draft.status"),
      meta: formatAgo(intl, now - 2 * 60 * 60 * 1000),
      status: text("app.pending.status.draft", { step: 2, count: 3 }),
    },
    {
      ...KINDS.checking,
      pill: text("app.uploads.chip.checking"),
      meta: saved,
      status: text("app.pending.status.checkAgainWhenConnected"),
    },
    {
      ...KINDS.inReview,
      pill: text("app.pending.pill.inReview"),
      meta: text("app.pending.meta.submitted", {
        date: formatRowDay(intl, new Date(new Date(now).getFullYear(), 9, 2).getTime()),
      }),
    },
  ];
  return (
    <>
      {rows.map((row) => (
        <PendingCard key={row.title} {...row} onOpen={fn()} />
      ))}
    </>
  );
}

/**
 * Done when (PRD-1273): every row is one height, and no detail line wraps at 320, 360 or
 * 390px (the sheet's list width there) in English, Spanish or Portuguese. A reason too
 * long for the row ends in an ellipsis; a detail that does not fit drops whole.
 */
export const FitsEveryLanguage: Story = {
  globals: { viewport: { value: "desktop" } },
  render: () => (
    <div className="flex flex-col gap-8">
      {(Object.keys(CATALOGS) as (keyof typeof CATALOGS)[]).map((locale) => (
        <IntlProvider key={locale} locale={locale} messages={CATALOGS[locale]}>
          <section className="flex flex-wrap items-start gap-4" data-locale={locale}>
            {[288, 328, 358].map((width) => (
              <div key={width} className="flex flex-col gap-(--gg-list-gap)" style={{ width }}>
                <LocalizedKinds />
              </div>
            ))}
          </section>
        </IntlProvider>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectItemRowsFit(canvasElement);
  },
};
