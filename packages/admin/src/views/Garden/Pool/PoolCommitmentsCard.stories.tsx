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

const GROUP_TITLES = new Map([...STORY_TITLES, ...STORY_GROUP_TITLES]);

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
          "Offers and Requests, one card of promises for the whole pool: search, the Open · Confirmed · Past chips, a Past due chip for live rows the chain would let anyone expire, a Needs recovery chip for those and the disputed ones, and rows that open in the left inspector. Copies made together are one group row that opens the group's inspector (PRD-1022 D3), and a group's copy that didn't send folds into it with Finish Creating (n); Past due and Needs recovery still name each promise on its own. Expire now… is outlined where it sits; the red is for the confirm inside its dialog.",
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
 * The cockpit's phone columns (296, 336 and 366px: a 320, 360 and 390px screen less the
 * shell's 12px phone gutters) in English, Spanish and Portuguese. A row's act is its icon
 * there, and a queued row's two acts stack, so every row keeps its pill and its due date
 * whole beside the tile and the acts.
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
    // The pill is the row's state, so it never ends in an ellipsis. One still does on a
    // 320px screen: the wait on garden membership needs up to 147px beside the stacked
    // acts' 127px. Shorter words or a pill that runs under the acts is an open call, so the
    // story names that pill instead of hiding it.
    const isOpenCall = (row: HTMLElement) => {
      const locale = row.closest("[data-locale]")?.getAttribute("data-locale") as
        | keyof typeof CATALOGS
        | undefined;
      return (
        row.closest("[data-fit-width]")?.getAttribute("data-fit-width") === "296" &&
        locale !== undefined &&
        pillOf(row)?.textContent === CATALOGS[locale]["cockpit.garden.pool.queued.waiting"]
      );
    };
    const cutPills = rows.filter((row) => isCut(pillOf(row)) && !isOpenCall(row));
    await expect(cutPills.map((row) => row.textContent)).toEqual([]);
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
