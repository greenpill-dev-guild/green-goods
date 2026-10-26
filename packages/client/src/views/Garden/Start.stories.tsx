import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { JOURNEY_GARDEN } from "../../../../shared/.storybook/clientJourneyFixtures";
import { withAppPage } from "../../../../shared/.storybook/decorators";
import {
  START_ACTIONS,
  START_PROMISE_ONE_ACTION,
  START_PROMISE_THREE_ACTIONS,
  startStepFixture,
} from "../../../../shared/.storybook/submitWorkFixtures";
import { Domain } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";
import { presentState, promiseDueDetail } from "@/components/Features/Commitments";
import { type StartAsk, WorkStart, type WorkStartProps } from "./Start";

const pickHubKeys = fn();
const DUE_NOV_30 = 1_796_040_000n; // 30 November 2026, midday UTC

/** An Open ask of the garden's that takes evidence only, as step 17's listing will hand it in. */
function useHubKeysAsk(): StartAsk {
  const intl = useIntl();
  const state = presentState("REQUESTED");
  return {
    key: "ask-31",
    card: {
      title: "Hub keys handover",
      direction: "REQUEST",
      status: { label: intl.formatMessage({ id: state.labelId }), tone: state.tone },
      progress: null,
      units: null,
      due: promiseDueDetail(intl, DUE_NOV_30),
      needs: [intl.formatMessage({ id: "app.garden.start.need.evidence" })],
    },
    onPick: pickHubKeys,
  };
}

/** The step as the flow mounts it; the domain chip is kept here the way the work store keeps it. */
function StartStep({ withAsk = false, ...props }: WorkStartProps & { withAsk?: boolean }) {
  const [domain, setDomain] = useState(props.selectedDomain);
  const ask = useHubKeysAsk();
  return (
    <WorkStart
      {...props}
      asks={withAsk ? [ask] : props.asks}
      selectedDomain={domain}
      setSelectedDomain={(next) => {
        setDomain(next);
        props.setSelectedDomain(next);
      }}
    />
  );
}

/**
 * Logging work's Start step (DL-131), in the shell's page padding. No Start button: a promise or
 * an action moves on, and the domain chips only filter. The member's promises lead as 132px
 * cards with Log Work on Its Own last; a promise with actions opens its own screen; otherwise the
 * garden's actions are two-up tiles of one height under capsule chips with All.
 */
const meta: Meta<typeof WorkStart> = {
  title: "Client/Work/Start",
  component: WorkStart,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobileSmall" } },
  decorators: [
    (Story) => (
      <div className="padded flex flex-col gap-4 py-6">
        <Story />
      </div>
    ),
    withAppPage,
  ],
  args: {
    start: startStepFixture(),
    actionsLoading: false,
    hasActions: true,
    selectedActionUID: null,
    selectedDomain: null,
    setSelectedDomain: fn(),
    gardenQuestion: null,
    link: { status: "none", onRetry: fn(), onLetGo: fn() },
  },
  render: (args) => <StartStep {...args} />,
};

export default meta;
type Story = StoryObj<typeof WorkStart>;

const box = (element: Element) => element.getBoundingClientRect();

/** Nothing owed, three domains: the garden's actions under All and a chip per domain. */
export const NothingOwed: Story = {
  args: { start: startStepFixture({ chooseAction: fn(async () => undefined) }) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const tiles = canvas.getAllByRole("option");
    await expect(tiles).toHaveLength(START_ACTIONS.length);
    // Every tile one height, each title two lines high, a long one clipped at the second.
    await expect(new Set(tiles.map((tile) => box(tile).height)).size).toBe(1);
    for (const tile of tiles) {
      const title = within(tile).getByRole("heading");
      const line = Number.parseFloat(getComputedStyle(title).lineHeight);
      await expect(box(title).height).toBeCloseTo(line * 2, 0);
    }
    // A chip filters and chooses nothing; a tile chooses and moves on.
    await userEvent.click(canvas.getByRole("button", { name: "Waste" }));
    await expect(args.setSelectedDomain).toHaveBeenLastCalledWith(Domain.WASTE);
    await expect(canvas.getAllByRole("option")).toHaveLength(1);
    await expect(args.start.chooseAction).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "All" }));
    await userEvent.click(canvas.getAllByRole("option")[0]);
    await expect(args.start.chooseAction).toHaveBeenCalledWith(1);
  },
};

/** Nothing owed in a garden with one domain: no chips. */
export const NothingOwedOneDomain: Story = {
  args: {
    start: startStepFixture({
      actions: START_ACTIONS.filter((action) => action.domain === Domain.EDU),
      domains: [Domain.EDU],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("group", { name: "Domains" })).toBeNull();
    await expect(canvas.getAllByRole("option")).toHaveLength(3);
  },
};

/** The member's promises: a promise with one action and one with three and evidence. */
export const Promises: Story = {
  args: {
    start: startStepFixture({
      screen: { kind: "promises" },
      promises: [START_PROMISE_ONE_ACTION, START_PROMISE_THREE_ACTIONS],
    }),
  },
  play: async ({ canvasElement }) => {
    const cards = Array.from(canvasElement.querySelectorAll('[data-component="PromiseCard"]'));
    await expect(cards).toHaveLength(2);
    for (const card of cards) await expect(box(card).height).toBe(132);
    // Three actions and evidence: two needs show and the other two fold into +2.
    await expect(within(cards[1] as HTMLElement).getByText("+2")).toBeVisible();
    await expect(canvasElement.querySelector('[data-component="LogWorkOnItsOwn"]')).toBeTruthy();
  },
};

/** A promise with one action, on its own screen: the action as a row, and no evidence row. */
export const PromiseWithOneAction: Story = {
  args: {
    start: startStepFixture({
      screen: { kind: "promise", promise: START_PROMISE_ONE_ACTION },
      promises: [START_PROMISE_ONE_ACTION],
    }),
  },
};

/** A promise with three actions that takes evidence: Add Evidence first, then three rows. */
export const PromiseWithThreeActionsAndEvidence: Story = {
  args: {
    start: startStepFixture({
      screen: { kind: "promise", promise: START_PROMISE_THREE_ACTIONS },
      promises: [START_PROMISE_THREE_ACTIONS],
    }),
  },
  play: async ({ canvasElement }) => {
    const evidence = canvasElement.querySelector('[data-component="AddEvidence"]') as Element;
    const heading = within(canvasElement).getByRole("heading", {
      name: "Actions for This Promise",
    });
    await expect(evidence.compareDocumentPosition(heading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await expect(within(canvasElement).queryByRole("listbox")).toBeNull();
  },
};

/**
 * A garden with one action and nothing owed, with an Open ask listed that takes evidence only:
 * the step stays, since there is a choice to make, and lists the ask with Log Work on Its Own.
 */
export const OpenEvidenceOnlyAsk: Story = {
  args: {
    start: startStepFixture({
      screen: { kind: "promises" },
      actions: START_ACTIONS.slice(0, 1),
      domains: [Domain.EDU],
    }),
  },
  render: (args) => <StartStep {...args} withAsk />,
  play: async ({ canvasElement }) => {
    pickHubKeys.mockClear();
    const card = canvasElement.querySelector('[data-component="PromiseCard"]') as HTMLElement;
    await expect(box(card).height).toBe(132);
    await userEvent.click(card);
    await expect(pickHubKeys).toHaveBeenCalledTimes(1);
  },
};

/** No garden the flow can use yet: the garden question, with the Community Garden's door. */
export const NoGardenYet: Story = {
  args: {
    gardenQuestion: {
      gardens: [],
      selected: null,
      onSelect: fn(),
      hasJoined: false,
      loading: false,
      joinable: {
        id: JOURNEY_GARDEN,
        name: "Green Goods Community Garden",
      } as NonNullable<WorkStartProps["gardenQuestion"]>["joinable"],
      joining: false,
      onJoin: fn(),
    },
  },
};
