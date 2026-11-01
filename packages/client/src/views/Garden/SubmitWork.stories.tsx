import { useActions, useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useWorkSubmissionFlowController } from "@green-goods/shared/hooks/client-ui/work/useWorkSubmissionFlowController";
import {
  useCommitment,
  useCommitmentCycle,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import {
  AUTUMN_PLANTING,
  JOURNEY_CYCLE_NAMES,
  JOURNEY_GARDEN_RECORD,
} from "../../../../shared/.storybook/clientJourneyFixtures";
import {
  withAppPage,
  withRouter,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import {
  SEEDLING_COMMITMENT,
  START_PROMISE_ONE_ACTION,
  START_PROMISE_THREE_ACTIONS,
  startStepFixture,
  submitWorkControllerFixture,
} from "../../../../shared/.storybook/submitWorkFixtures";
import Work from ".";

const exitFlow = fn();

/** Submit Work on one step, for the east-beds promise unless `linked` is off. */
const onStep =
  (
    step: "start" | "media" | "review",
    options: Parameters<typeof submitWorkControllerFixture>[1] = {}
  ) =>
  () => {
    exitFlow.mockClear();
    mocked(useWorkSubmissionFlowController).mockReturnValue({
      ...submitWorkControllerFixture(step, options),
      exit: exitFlow,
    });
    mocked(useCommitment).mockReturnValue({
      commitment: SEEDLING_COMMITMENT,
    } as unknown as ReturnType<typeof useCommitment>);
    mocked(useCommitmentCycle).mockReturnValue({
      cycle: AUTUMN_PLANTING,
    } as unknown as ReturnType<typeof useCommitmentCycle>);
    mocked(useGardens).mockReturnValue({
      data: [JOURNEY_GARDEN_RECORD],
    } as unknown as ReturnType<typeof useGardens>);
    mocked(useActions).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useActions>);
    return resetHookMocks(
      useWorkSubmissionFlowController,
      useCommitment,
      useCommitmentCycle,
      useGardens,
      useActions
    );
  };

/**
 * Submit Work once a promise was chosen at Start (D16, O9): every later step
 * leads with its heading card, then the promise it's for, pinned under the top
 * bar as the page scrolls. The card opens the promise, where Not for This
 * Promise unlinks the work. Saving the draft stays invisible (D29).
 */
const meta: Meta<typeof Work> = {
  title: "Client/Work/SubmitWork",
  component: Work,
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [withRouter(["/garden"]), withSeededQueryClient(JOURNEY_CYCLE_NAMES), withAppPage],
};

export default meta;
type Story = StoryObj<typeof Work>;

/** The step markers, centered in the bar and clear of Back (DL-132). */
const markersCenteredInBar = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const back = canvas.getByRole("button", { name: "Go back" }).getBoundingClientRect();
  const steps = within(canvas.getByRole("list", { name: "Steps" })).getAllByRole("listitem");
  const first = steps[0].getBoundingClientRect();
  const last = steps.at(-1)?.getBoundingClientRect() as DOMRect;
  return {
    steps,
    clearOfBack: first.left >= back.right,
    // How far the markers' middle sits from the bar's; the bar spans the viewport.
    offCenter: (first.left + last.right) / 2 - window.innerWidth / 2,
  };
};

/**
 * Frame `submit-start`: Start on the garden's actions, with no Start button and no bar at all,
 * the markers centered in the bar (DL-132).
 */
export const StartOnTheGardensActions: Story = {
  tags: ["storybook-ci"],
  beforeEach: onStep("start"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Start Gardening" })).toBeNull();
    await expect(
      canvasElement.ownerDocument.querySelector('[data-component="FlowBar"]')
    ).toBeNull();
    const { steps, clearOfBack, offCenter } = markersCenteredInBar(canvasElement);
    await expect(steps).toHaveLength(4);
    await expect(steps[0]).toHaveAttribute("aria-current", "step");
    await expect(clearOfBack).toBe(true);
    await expect(offCenter).toBeCloseTo(0, 0);
    // Back on Start leaves the flow.
    await userEvent.click(canvas.getByRole("button", { name: "Go back" }));
    await expect(exitFlow).toHaveBeenCalledTimes(1);
  },
};

/** Start on the member's promises: compact cards with Log Work on Its Own last. */
export const StartOnPromises: Story = {
  beforeEach: onStep("start", {
    start: startStepFixture({
      screen: { kind: "promises" },
      promises: [START_PROMISE_ONE_ACTION, START_PROMISE_THREE_ACTIONS],
    }),
  }),
};

/**
 * A resumed draft whose garden is not the active one: Start in the draft's garden, which one
 * line under the steps names (decision 28).
 */
export const StartForAResumedDraft: Story = {
  beforeEach: onStep("start", {
    namedGarden: { ...JOURNEY_GARDEN_RECORD, name: "Hilltop Market Garden" },
  }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId("submission-garden")).toHaveTextContent(
      "Hilltop Market Garden"
    );
  },
};

/**
 * A garden with one action and nothing owed skips Start (decision 17): Media opens with that
 * action, the first marker done, and Back leaves, since the path never went through Start.
 */
export const StartSkippedForOneAction: Story = {
  beforeEach: onStep("media", { linked: false, start: startStepFixture({ skipped: true }) }),
  play: async ({ canvasElement }) => {
    const { steps } = markersCenteredInBar(canvasElement);
    // The shape adding proof shows too: four markers, Start already checked (DL-153).
    await expect(steps).toHaveLength(4);
    await expect(steps[1]).toHaveAttribute("aria-current", "step");
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Go back" }));
    await expect(exitFlow).toHaveBeenCalledTimes(1);
  },
};

/**
 * Frame `submit-media`: from a promise's page the link skips Start, so Media opens with the
 * heading, the promise pinned, and the photo rule met.
 */
export const MediaForAPromise: Story = {
  tags: ["storybook-ci"],
  beforeEach: onStep("media", { start: startStepFixture({ skipped: true }) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = canvas.getByText("Upload Media");
    const pinned = canvas.getByTestId("pinned-promise");
    // The heading comes first; the promise follows it (O9).
    await expect(
      heading.compareDocumentPosition(pinned) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    await expect(canvas.getByText("1 photo added")).toBeVisible();
  },
};

/** Frame `submit-review`: Review's sections, the promise pinned, and where the work waits. */
export const ReviewForAPromise: Story = {
  beforeEach: onStep("review"),
};

/**
 * A resumed draft for the hub's Open ask at Review (Rule 20). It skipped Start, whose asks say
 * what taking one up asks for, so the bar says it above Upload Work, before the first prompt.
 */
export const ReviewForAnOpenAsk: Story = {
  beforeEach: onStep("review", { takesUp: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const note = canvas.getByText(/^Uploading takes up the ask first\./);
    await expect(note).toHaveTextContent("It opens 3 wallet or passkey prompts");
    await expect(canvas.getByRole("button", { name: "Upload Work" })).toHaveAccessibleDescription(
      note.textContent ?? ""
    );
  },
};

export const ReviewForAnOpenAskSpanish: Story = {
  beforeEach: onStep("review", { takesUp: true }),
  globals: { locale: "es", viewport: { value: "mobileSmall" } },
};

export const ReviewForAnOpenAskPortuguese: Story = {
  beforeEach: onStep("review", { takesUp: true }),
  globals: { locale: "pt", viewport: { value: "mobileSmall" } },
};

/** Frame `submit-for-sheet`: the promise in a half sheet, with Not for This Promise. */
export const PromiseSheet: Story = {
  beforeEach: onStep("review"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Work for Transplant 36 seedlings/ }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByTestId("work-for-unlink")).toBeVisible());
    (canvasElement.ownerDocument.activeElement as HTMLElement | null)?.blur();
  },
};

/** Work that isn't for a promise pins nothing. */
export const MediaWithoutAPromise: Story = {
  beforeEach: onStep("media", { linked: false }),
};

/** Real photo, fictional data, no promise: the documentation's evidence example. */
export const MediaWithExamplePhoto: Story = {
  beforeEach: onStep("media", { linked: false, documentationPhoto: true }),
};

/** The same example at Review, with count, time and a concrete field note. */
export const ReviewWithExamplePhoto: Story = {
  beforeEach: onStep("review", { linked: false, documentationPhoto: true }),
};
