import { useActions, useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useWorkSubmissionFlowController } from "@green-goods/shared/hooks/client-ui/work/useWorkSubmissionFlowController";
import {
  useCommitment,
  useCommitmentCycle,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";
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
  submitWorkControllerFixture,
} from "../../../../shared/.storybook/submitWorkFixtures";
import Work from ".";

/** Submit Work on one step, for the east-beds promise unless `linked` is off. */
const onStep =
  (step: "media" | "review", { linked = true }: { linked?: boolean } = {}) =>
  () => {
    mocked(useWorkSubmissionFlowController).mockReturnValue(
      submitWorkControllerFixture(step, { linked })
    );
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

/** Frame `submit-media`: the Media heading, the promise, and the photo rule met. */
export const MediaForAPromise: Story = {
  tags: ["storybook-ci"],
  beforeEach: onStep("media"),
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
