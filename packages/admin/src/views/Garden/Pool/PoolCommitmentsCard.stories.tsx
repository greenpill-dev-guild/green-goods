import enMessages from "@green-goods/shared/i18n/en.json";
import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useState } from "react";
import { IntlProvider } from "react-intl";
import { expect, userEvent, within } from "storybook/test";
import { daysAgo } from "../../../../../shared/.storybook/fixtures";
import { expectItemRowsFit } from "../../../../../shared/.storybook/itemRowFit";
import {
  type PoolCommitmentFocus,
  type PoolCommitmentScope,
  PoolCommitmentsCard,
} from "./PoolCommitmentsCard";
import { STORY_COMMITMENTS, STORY_TITLES, storyCommitment } from "./poolStoryCommitments";
import {
  STORY_GROUP_COPIES,
  STORY_GROUP_ID,
  STORY_GROUP_TITLES,
  storyPoolConsole,
} from "./poolStoryFixtures";
import {
  nameVoucherMembers,
  STORY_GREEN_GOODS_COMMITMENTS,
  STORY_GREEN_GOODS_RETURN_FAILED,
  STORY_GREEN_GOODS_VOUCHERS,
  STORY_HUB_DAY_TITLES,
  STORY_MARA_VISIT,
  STORY_TECH_AND_SUN_COMMITMENTS,
  STORY_TECH_AND_SUN_VOUCHERS,
  STORY_VOUCHER_TITLES,
  storyHubDay,
  storyVoucherConsole,
} from "./poolStoryVouchers";

const GROUP_TITLES = new Map([...STORY_TITLES, ...STORY_GROUP_TITLES]);

/** Three hub days Tech and Sun made together; Mara booked the first, and her visit is under way. */
const HUB_DAY_COPIES = [
  storyHubDay(61, {
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE",
    state: "ACCEPTED",
    counterparty: STORY_MARA_VISIT.holder,
  }),
  storyHubDay(62),
  storyHubDay(63),
];

/** The card owns no filter state; the story does, so the chips work. */
function PoolCommitmentsCardWithScope(props: ComponentProps<typeof PoolCommitmentsCard>) {
  const [scope, setScope] = useState<PoolCommitmentScope>(props.scope);
  const [focus, setFocus] = useState<PoolCommitmentFocus>(props.focus);
  return (
    <div className="max-w-2xl p-4" data-tone="garden">
      <PoolCommitmentsCard
        {...props}
        scope={scope}
        onScopeChange={setScope}
        focus={focus}
        onFocusChange={setFocus}
      />
    </div>
  );
}

const meta: Meta<typeof PoolCommitmentsCard> = {
  title: "Admin/Pool/PoolCommitmentsCard",
  component: PoolCommitmentsCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Offers and Asks, one card of promises for the whole pool: search, the Open · Confirmed · Past chips, a Past due chip for live rows the chain would let anyone expire, a Needs recovery chip for those and the disputed ones, and rows that open in the left inspector. Copies made together are one group row that opens the group's inspector (PRD-1022 D3), and a group's copy that didn't send folds into it with Finish Creating (n); Past due and Needs recovery still name each promise on its own. Expire now… is outlined where it sits; the red is for the confirm inside its dialog. A voucher booking's acts wait in Review Promises: its offer's row names who booked it and what one booking takes, and a group of hub days counts booked and open copies in the row's right slot.",
      },
    },
  },
  args: {
    onOpenCommitment: () => undefined,
    onOpenGroup: () => undefined,
    onSeed: () => undefined,
    canSeed: true,
    scope: "open",
    focus: null,
    vouchers: storyVoucherConsole(),
  },
  render: (args) => <PoolCommitmentsCardWithScope {...args} />,
};

export default meta;
type Story = StoryObj<typeof PoolCommitmentsCard>;

export const Open: Story = {
  args: { console: storyPoolConsole() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Prune the north beds")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Confirmed" }));
    await expect(await canvas.findByText("Repair the greenhouse")).toBeVisible();
  },
};

/** Ten copies made together, five days in: one group row among the pool's own. */
export const WithGroup: Story = {
  args: {
    console: storyPoolConsole({
      commitments: [...STORY_COMMITMENTS, ...STORY_GROUP_COPIES],
      titles: GROUP_TITLES,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Household water survey")).toBeVisible();
  },
};

/** Nine created and one waiting in the steward's queue: the row offers Finish Creating (1). */
export const GroupDidNotSendOne: Story = {
  args: {
    console: storyPoolConsole({
      commitments: [...STORY_COMMITMENTS, ...STORY_GROUP_COPIES.slice(0, 9)],
      titles: GROUP_TITLES,
      queuedGroupCopies: new Map([[STORY_GROUP_ID, ["job-copy"]]]),
      pendingCreates: [
        {
          jobId: "job-copy",
          chainId: 42161,
          poolId: "7",
          direction: "REQUEST",
          title: "Household water survey",
          unitLabel: "survey",
          targetUnits: "1",
          waitingForMembership: false,
          discardable: true,
          failed: true,
          createdAt: daysAgo(0) * 1000,
        },
      ],
    }),
  },
};

export const PastDue: Story = {
  args: { console: storyPoolConsole(), focus: "pastDue" },
};

/** Reached from Needs recovery on the stats card: the dispute and the past-due row, nothing else. */
export const NeedsRecovery: Story = {
  args: {
    console: storyPoolConsole({
      commitments: [
        ...STORY_COMMITMENTS,
        storyCommitment({
          id: "42161-7",
          commitmentId: 7n,
          onchainState: "DISPUTED",
          derivedState: "DISPUTED",
          state: "DISPUTED",
          metadataCID: "bafy-6",
        }),
      ],
    }),
    focus: "recovery",
  },
};

export const Queued: Story = {
  args: {
    console: storyPoolConsole({
      pendingCreates: [
        {
          jobId: "job-1",
          chainId: 42161,
          poolId: "7",
          direction: "OFFER",
          title: "Compost workshop",
          unitLabel: "workshop",
          targetUnits: "1",
          waitingForMembership: false,
          discardable: true,
          failed: false,
          createdAt: daysAgo(0) * 1000,
        },
      ],
    }),
  },
};

/** Send Now pressed: the row says the wallet is asking. */
export const QueuedSending: Story = {
  args: {
    console: storyPoolConsole({
      pendingCreates: [
        {
          jobId: "job-1",
          chainId: 42161,
          poolId: "7",
          direction: "OFFER",
          title: "Compost workshop",
          unitLabel: "workshop",
          targetUnits: "1",
          waitingForMembership: false,
          discardable: true,
          failed: false,
          createdAt: daysAgo(0) * 1000,
        },
      ],
      queuedPhase: (jobId) =>
        jobId === "job-1" ? { status: "signing", key: "job-1" } : { status: "idle" },
    }),
  },
};

/** The two queued rows that are not plain "Queued": send failure and the membership wait. */
export const QueuedNeedsAttention: Story = {
  args: {
    console: storyPoolConsole({
      pendingCreates: [
        {
          jobId: "job-2",
          chainId: 42161,
          poolId: "7",
          direction: "OFFER",
          title: "Repair the tool library",
          unitLabel: "repair",
          targetUnits: "1",
          waitingForMembership: false,
          discardable: true,
          failed: true,
          createdAt: daysAgo(0) * 1000,
        },
        {
          jobId: "job-3",
          chainId: 42161,
          poolId: "7",
          direction: "REQUEST",
          title: "Seed swap afternoon",
          unitLabel: "session",
          targetUnits: "2",
          waitingForMembership: true,
          discardable: true,
          failed: false,
          createdAt: daysAgo(0) * 1000,
        },
      ],
    }),
  },
};

export const Empty: Story = {
  args: { console: storyPoolConsole({ commitments: [], claims: [] }) },
};

const CATALOGS = { en: enMessages, es: esMessages, pt: ptMessages } as const;

/** A queued promise of each kind beside the pool's own, one of them past due. */
const PHONE_QUEUE = storyPoolConsole({
  pendingCreates: [
    {
      jobId: "job-1",
      chainId: 42161,
      poolId: "7",
      direction: "OFFER",
      title: "Compost workshop",
      unitLabel: "workshop",
      targetUnits: "1",
      waitingForMembership: false,
      discardable: true,
      failed: false,
      createdAt: daysAgo(0) * 1000,
    },
    {
      jobId: "job-2",
      chainId: 42161,
      poolId: "7",
      direction: "OFFER",
      title: "Repair the tool library",
      unitLabel: "repair",
      targetUnits: "1",
      waitingForMembership: false,
      discardable: true,
      failed: true,
      createdAt: daysAgo(0) * 1000,
    },
    {
      jobId: "job-3",
      chainId: 42161,
      poolId: "7",
      direction: "REQUEST",
      title: "Seed swap afternoon",
      unitLabel: "session",
      targetUnits: "2",
      waitingForMembership: true,
      discardable: true,
      failed: false,
      createdAt: daysAgo(0) * 1000,
    },
  ],
});

/**
 * The Hub's phone columns (296, 336 and 366px: a 320, 360 and 390px screen less the
 * shell's 12px phone gutters) in English, Spanish and Portuguese. A row's act is its icon
 * there, and a queued row's two acts stack, so every row keeps its pill and its due date
 * whole beside the tile and the acts, and every act keeps its whole finger box in the row.
 */
export const PhoneFitsEveryLanguage: Story = {
  tags: ["storybook-ci"],
  globals: { viewport: { value: "desktop" } },
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <div className="flex flex-col gap-8 p-4" data-tone="garden">
      {(Object.keys(CATALOGS) as (keyof typeof CATALOGS)[]).map((locale) => (
        <IntlProvider key={locale} locale={locale} messages={CATALOGS[locale]}>
          <section className="flex flex-wrap items-start gap-4" data-locale={locale}>
            {[296, 336, 366].map((width) => (
              <div key={width} style={{ inlineSize: width }} data-fit-width={width}>
                <PoolCommitmentsCard {...args} console={PHONE_QUEUE} />
              </div>
            ))}
          </section>
        </IntlProvider>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectItemRowsFit(canvasElement);
    const rows = [...canvasElement.querySelectorAll<HTMLElement>(".gg-item-row")];
    const isCut = (element: HTMLElement | null) =>
      element ? element.scrollWidth > element.clientWidth + 0.5 : false;
    const pillOf = (row: HTMLElement) =>
      row.querySelector<HTMLElement>(".gg-item-row-body .truncate");
    // The pill is the row's state, so it never ends in an ellipsis.
    const cutPills = rows.filter((row) => isCut(pillOf(row)));
    await expect(cutPills.map((row) => row.textContent)).toEqual([]);
    // An act's finger box is the button and its block margin. Stacked acts must keep the
    // whole box inside the 88px row, which clips what overflows.
    const clippedActs = rows.flatMap((row) => {
      const box = row.getBoundingClientRect();
      return [...row.querySelectorAll<HTMLElement>(".gg-item-row-action button")].filter(
        (button) => {
          // The form a row's width hides (Expire Now…'s words below 480px) takes no room.
          if (button.getClientRects().length === 0) return false;
          const rect = button.getBoundingClientRect();
          const style = getComputedStyle(button);
          return (
            rect.top - Number.parseFloat(style.marginTop) < box.top - 0.5 ||
            rect.bottom + Number.parseFloat(style.marginBottom) > box.bottom + 0.5
          );
        }
      );
    });
    await expect(clippedActs.map((button) => button.getAttribute("aria-label"))).toEqual([]);
    // A promise's due date leads its line whole.
    const cutDates = rows.filter((row) =>
      isCut(row.querySelector<HTMLElement>("time.gg-item-row-detail-text"))
    );
    await expect(cutDates.map((row) => row.textContent)).toEqual([]);
  },
};

/** A pre-update reward stays visible, without an impossible send. */
export const RewardDeferred: Story = {
  args: {
    console: storyPoolConsole({
      pendingCreates: [
        {
          jobId: "reward-deferred",
          chainId: 42161,
          poolId: "7",
          direction: "REQUEST",
          title: "Rewarded survey",
          unitLabel: "survey",
          targetUnits: "1",
          waitingForMembership: false,
          settlementDeferred: true,
          failed: false,
          discardable: true,
          createdAt: daysAgo(0) * 1000,
        },
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("G$ reward deferred")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Send Now" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Discard" })).toBeEnabled();
  },
};

export const DocumentationPartial: Story = {
  args: {
    console: storyPoolConsole({
      commitments: STORY_GROUP_COPIES.slice(0, 9).map((copy) => ({
        ...copy,
        unitLabel: "check",
        dueDate: 1791209600n,
        considerationRail: "NONE",
        considerationAmount: 0n,
        considerationPaid: false,
      })),
      titles: new Map([
        [
          "bafy-group-survey",
          {
            version: 1,
            title: "Check the household rainwater barrels",
            displayGroup: { version: 1, id: STORY_GROUP_ID },
          },
        ],
      ]),
      queuedGroupCopies: new Map([[STORY_GROUP_ID, ["documentation-copy"]]]),
      pendingCreates: [
        {
          jobId: "documentation-copy",
          chainId: 42161,
          poolId: "7",
          direction: "REQUEST",
          title: "Check the household rainwater barrels",
          unitLabel: "check",
          targetUnits: "1",
          waitingForMembership: false,
          discardable: true,
          failed: true,
          createdAt: daysAgo(0) * 1000,
        },
      ],
    }),
  },
};

/**
 * Tech and Sun's hub days (PRD-1297 surface 6): Mara's hub day is booked, so its row names her
 * and what one booking takes; the two offers still being booked say how far each booking has
 * come. Their acts wait in Review Promises, not here.
 */
export const VoucherBookings: Story = {
  args: {
    console: storyPoolConsole({
      commitments: STORY_TECH_AND_SUN_COMMITMENTS,
      claims: [],
      titles: STORY_VOUCHER_TITLES,
    }),
    vouchers: storyVoucherConsole(STORY_TECH_AND_SUN_VOUCHERS),
  },
  beforeEach: nameVoucherMembers,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const mara = await canvas.findByTestId("pool-commitment-43");
    await expect(await within(mara).findByText("Mara")).toBeVisible();
    await expect(within(mara).getByText(/Takes 1 Tech and Sun voucher/)).toBeVisible();
    await expect(canvas.getByText(/Booking: deposit confirmed/)).toBeVisible();
    await expect(canvas.getByText(/Booking asked/)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Report Visit…" })).toBeNull();
  },
};

/** Green Goods' Claude access: Lina's stopped after 12 days; proposing her return is Review Promises' act. */
export const VoucherEndedEarly: Story = {
  args: {
    console: storyPoolConsole({
      commitments: STORY_GREEN_GOODS_COMMITMENTS,
      claims: [],
      titles: STORY_VOUCHER_TITLES,
    }),
    vouchers: storyVoucherConsole(STORY_GREEN_GOODS_VOUCHERS),
  },
  beforeEach: nameVoucherMembers,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Ended early · 12 of 30 days/)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Propose Return…" })).toBeNull();
  },
};

/**
 * Lina's access is past its due date and the 6 back to her didn't arrive: the row needs
 * recovery, never Expire Now, since expiring it would return nothing; the retry is the queue's.
 */
export const VoucherTransferFailedPastDue: Story = {
  args: {
    console: storyPoolConsole({
      commitments: STORY_GREEN_GOODS_COMMITMENTS.map((row) =>
        row.commitmentId === 51n ? { ...row, dueDate: BigInt(daysAgo(2)) } : row
      ),
      claims: [],
      titles: STORY_VOUCHER_TITLES,
    }),
    vouchers: storyVoucherConsole(STORY_GREEN_GOODS_RETURN_FAILED),
  },
  beforeEach: nameVoucherMembers,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "Needs recovery (1)" })).toBeVisible();
    await expect(canvas.getByText(/Return didn’t go through/)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Expire Now…" })).toBeNull();
    await expect(canvas.queryByRole("button", { name: "Retry Transfer" })).toBeNull();
  },
};

/** Copies made together are one row, Mara's booked copy too: booked and open in the right slot. */
export const VoucherGroupedBooking: Story = {
  args: {
    console: storyPoolConsole({
      commitments: HUB_DAY_COPIES,
      claims: [],
      titles: STORY_HUB_DAY_TITLES,
    }),
    vouchers: storyVoucherConsole({
      ...STORY_TECH_AND_SUN_VOUCHERS,
      asks: [],
      bookings: [{ ...STORY_MARA_VISIT, commitmentId: 61n }],
    }),
  },
  beforeEach: nameVoucherMembers,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId("pool-group-group-hubdays01");
    await expect(within(group).getByText("1 booked")).toBeVisible();
    await expect(within(group).getByText("2 of 3 open")).toBeVisible();
    await expect(within(group).getByText(/Takes 1 Tech and Sun voucher/)).toBeVisible();
    await expect(canvas.queryByTestId("pool-commitment-61")).toBeNull();
  },
};
