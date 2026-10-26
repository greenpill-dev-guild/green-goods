import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { JOURNEY_GARDEN } from "../../../../shared/.storybook/clientJourneyFixtures";
import { withAppPage } from "../../../../shared/.storybook/decorators";
import {
  START_ACTIONS,
  START_ASK_TITLES,
  START_ASKS,
  START_PROMISE_ONE_ACTION,
  START_PROMISE_THREE_ACTIONS,
  startStepFixture,
} from "../../../../shared/.storybook/submitWorkFixtures";
import { Domain } from "@green-goods/shared/types/domain";
import { WorkStart, type WorkStartProps } from "./Start";

/** The step as the flow mounts it; the domain chip is kept here the way the work store keeps it. */
function StartStep(props: WorkStartProps) {
  const [domain, setDomain] = useState(props.selectedDomain);
  return (
    <WorkStart
      {...props}
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
 * cards, then the garden's Open asks they could take up, with Log Work on Its Own last; a promise
 * or an ask with actions opens its own screen; otherwise the garden's actions are two-up tiles of
 * one height under capsule chips with All.
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
 * The garden's Open asks after Amara's promise (decision 18), read through the rule the step
 * reads them with: the ask she can take up in one tap is listed, while an approval-gated ask and
 * one she already asked for are not. The step says how many prompts taking one up brings.
 */
export const OpenAsk: Story = {
  args: {
    start: startStepFixture({
      screen: { kind: "promises" },
      promises: [START_PROMISE_ONE_ACTION],
      asks: START_ASKS,
      pickPromise: fn(),
    }),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const [listed, gated, requested] = [...START_ASK_TITLES.values()];
    await expect(canvas.getByRole("heading", { name: "Take Up an Ask" })).toBeVisible();
    await expect(
      canvas.getByText(
        "Taking one up opens 3 wallet or passkey prompts: the take-up, the work and its link."
      )
    ).toBeVisible();
    await expect(canvas.getByText(listed)).toBeVisible();
    await expect(canvas.queryByText(gated)).toBeNull();
    await expect(canvas.queryByText(requested)).toBeNull();
    const cards = Array.from(canvasElement.querySelectorAll('[data-component="PromiseCard"]'));
    for (const card of cards) await expect(box(card).height).toBe(132);
    await userEvent.click(canvas.getByText(listed));
    await expect(args.start.pickPromise).toHaveBeenCalledWith(START_ASKS[0]);
  },
};

export const OpenAskSpanish: Story = {
  args: OpenAsk.args,
  globals: { locale: "es", viewport: { value: "mobileSmall" } },
};

export const OpenAskPortuguese: Story = {
  args: OpenAsk.args,
  globals: { locale: "pt", viewport: { value: "mobileSmall" } },
};

/** An Open ask on its own screen: its action as a row, which takes the ask up as the work goes. */
export const OpenAskOwnScreen: Story = {
  args: {
    start: startStepFixture({
      screen: { kind: "promise", promise: START_ASKS[0] },
      asks: START_ASKS,
    }),
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
