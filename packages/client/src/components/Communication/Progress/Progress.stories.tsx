import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider, useIntl } from "react-intl";
import { expect, fn, within } from "storybook/test";
import { withAppPage } from "../../../../../shared/.storybook/decorators";
import { TopNav } from "@/components/Navigation";
import { OfflineIndicator } from "../Offline/OfflineIndicator";
import { FormProgress } from "./Progress";

/**
 * A flow's steps in its top bar, each named under its marker. Submit Work, adding
 * proof and composing a promise share it, so every flow shows where you are by name.
 */
const meta: Meta<typeof FormProgress> = {
  title: "Client/Navigation/FormProgress",
  component: FormProgress,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "centered" },
  args: {
    currentStep: 2,
    steps: ["Start", "Media", "Details", "Review"],
  },
};

export default meta;
type Story = StoryObj<typeof FormProgress>;

export const SubmitWork: Story = {
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list", { name: "Steps" });
    const steps = within(list).getAllByRole("listitem");
    await expect(steps).toHaveLength(4);
    // Each marker carries its step's name; the current one is marked as the step.
    for (const [index, name] of ["Start", "Media", "Details", "Review"].entries()) {
      await expect(within(steps[index]).getByText(name)).toBeVisible();
    }
    await expect(steps[1]).toHaveAttribute("aria-current", "step");
  },
};

export const AddingProof: Story = {
  args: { currentStep: 3, steps: ["Media", "Details", "Review"] },
};

const MESSAGES = { en, es, pt } as const;
type Locale = keyof typeof MESSAGES;

/** Each flow's step names by message id, as its view hands them to the tracker. */
const FLOW_STEPS = {
  submitWork: [
    "app.work.step.start",
    "app.work.step.media",
    "app.work.step.details",
    "app.work.step.review",
  ],
  proof: ["app.proof.beat.media", "app.proof.beat.details", "app.compose.beat.review"],
  compose: [
    "app.compose.beat.what",
    "app.compose.beat.howMuch",
    "app.compose.beat.details",
    "app.compose.beat.review",
  ],
} as const;

interface FlowTopBarProps {
  flow: keyof typeof FLOW_STEPS;
  currentStep: number;
  locale?: Locale;
  /** Shows the shell's offline banner over the bar, where `AppShell` mounts it. */
  offline?: boolean;
}

function FlowSteps({ flow, currentStep }: Pick<FlowTopBarProps, "flow" | "currentStep">) {
  const { formatMessage } = useIntl();
  return (
    <FormProgress
      currentStep={currentStep}
      steps={FLOW_STEPS[flow].map((id) => formatMessage({ id }))}
    />
  );
}

/** The real top bar with a flow's tracker in it, as the flow's page mounts them. */
function FlowTopBar({ flow, currentStep, locale = "en", offline = false }: FlowTopBarProps) {
  return (
    <IntlProvider locale={locale} messages={MESSAGES[locale]}>
      {offline ? <OfflineIndicator testState="offline" /> : null}
      <TopNav onBackClick={fn()} overlay data-testid="flow-top-bar">
        <FlowSteps flow={flow} currentStep={currentStep} />
      </TopNav>
    </IntlProvider>
  );
}

type FlowStory = StoryObj<typeof FlowTopBar>;

const inTopBar = {
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobileSmall" } },
  decorators: [withAppPage],
  argTypes: {
    flow: { control: "inline-radio", options: Object.keys(FLOW_STEPS) },
    locale: { control: "inline-radio", options: Object.keys(MESSAGES) },
  },
  args: { flow: "submitWork", currentStep: 2, locale: "en", offline: false },
  render: (args) => <FlowTopBar {...args} />,
} satisfies FlowStory;

const box = (element: Element) => element.getBoundingClientRect();
const centreY = ({ top, bottom }: DOMRect) => (top + bottom) / 2;

/** A step's marker: the circle around its number, or around the tick once the step is done. */
const markerOf = (step: HTMLElement, number: number) =>
  (within(step).queryByText(String(number)) ?? step.querySelector("svg"))
    ?.parentElement as HTMLElement;

/**
 * Where the tracker sits in the bar: every marker centres on Back, the step names
 * hang below it inside the bar, and nothing reaches into the bar's top padding.
 */
const sitsOnTheBackLine: NonNullable<FlowStory["play"]> = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const bar = canvas.getByTestId("flow-top-bar");
  const back = canvas.getByRole("button", { name: "Go back" });
  const tracker = canvas.getByRole("list");
  const steps = within(tracker).getAllByRole("listitem");

  // Flow pages offset their content by the bar's 80px.
  await expect(box(bar).height).toBe(80);
  for (const [index, step] of steps.entries()) {
    await expect(centreY(box(markerOf(step, index + 1)))).toBeCloseTo(centreY(box(back)), 0);
  }
  await expect(box(tracker).top).toBeGreaterThanOrEqual(
    box(bar).top + Number.parseFloat(getComputedStyle(bar).paddingTop)
  );
  await expect(box(tracker).bottom).toBeLessThanOrEqual(box(bar).bottom);
  // The first step's name stays clear of Back.
  await expect(box(steps[0].lastElementChild as Element).left).toBeGreaterThanOrEqual(
    box(back).right
  );
};

/**
 * Submit Work's tracker beside Back in the fixed top bar. The controls switch
 * the flow and the language; every flow keeps its markers on Back's centre line.
 */
export const InTopBar: FlowStory = {
  ...inTopBar,
  play: sitsOnTheBackLine,
};

/** Offline, the shell's banner lies over the bar's top padding and stops short of the markers. */
export const UnderOfflineBanner: FlowStory = {
  ...inTopBar,
  args: { ...inTopBar.args, offline: true },
  play: async (context) => {
    await sitsOnTheBackLine(context);
    const canvas = within(context.canvasElement);
    const [first] = within(canvas.getByRole("list")).getAllByRole("listitem");
    await expect(box(canvas.getByTestId("offline-indicator")).bottom).toBeLessThanOrEqual(
      box(markerOf(first, 1)).top
    );
  },
};
