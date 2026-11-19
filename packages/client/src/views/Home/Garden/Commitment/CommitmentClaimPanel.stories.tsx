import {
  claimFixture,
  commitmentFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import { CommitmentClaimPanel } from "./CommitmentClaimPanel";

const STEWARD = "0xfbaf2a9734eae75497e1695706cc45ddfa346ad6" as Address;
const GARDEN = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;

/**
 * The reader's own request to take up a steward-reviewed promise, once a steward declined it.
 * A request is only what waits on a steward's yes (DL-175), so the panel says requested where it
 * once said asked, and its fresh request is Request Again.
 */
const meta: Meta<typeof CommitmentClaimPanel> = {
  title: "Client/Commitments/CommitmentClaimPanel",
  component: CommitmentClaimPanel,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "padded" },
  globals: { viewport: { value: "mobile" } },
  args: {
    commitment: commitmentFixture({ claimMode: "APPROVAL_GATED" }),
    request: claimFixture({
      claimant: GARDEN,
      requestedBy: STEWARD,
      claimType: "GARDEN",
      state: "DECLINED",
    }),
    viewer: STEWARD,
    canAskAgain: true,
    isPending: false,
    onAskAgain: fn(),
    onBackToBrowse: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof CommitmentClaimPanel>;

/** A steward's request for their garden, declined while the promise is still open. */
export const DeclinedGardenRequest: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(
        "Only this request was cleared; nothing else about the promise changed. While it is still open you can request it again for your garden."
      )
    ).toBeVisible();
    await expect(canvas.getByText("Requested by")).toBeVisible();
    await expect(canvas.getByText("Requested")).toBeVisible();
    canvas.getByRole("button", { name: "Request Again" }).click();
    await expect(args.onAskAgain).toHaveBeenCalledTimes(1);
  },
};

/** The reader's own request, accepted. */
export const AcceptedRequest: Story = {
  args: {
    request: claimFixture({ claimant: STEWARD, requestedBy: STEWARD, state: "ACCEPTED" }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Your request was accepted")).toBeVisible();
    await expect(canvas.getByText("Requested")).toBeVisible();
  },
};

const WITHDRAWN_REASON_CID = "bafy-story-withdrawn-reason";

/** A steward withdrew the promise while the reader's request waited; the panel shows why. */
export const WithdrawnPromiseRequest: Story = {
  decorators: [
    withSeededQueryClient([
      [
        queryKeys.commitmentPooling.reason(WITHDRAWN_REASON_CID),
        {
          version: 1,
          reason: "The teacher is away until June and will offer the sessions again then.",
        },
      ],
    ]),
  ],
  args: {
    commitment: commitmentFixture({
      claimMode: "APPROVAL_GATED",
      cancelReasonCID: WITHDRAWN_REASON_CID,
    }),
    request: claimFixture({
      claimant: STEWARD,
      requestedBy: STEWARD,
      state: "SUPERSEDED",
      resolutionCode: "COMMITMENT_CANCELLED",
    }),
    canAskAgain: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("The promise was withdrawn")).toBeVisible();
    await expect(canvas.getByText("Reason")).toBeVisible();
    await expect(
      canvas.getByText("The teacher is away until June and will offer the sessions again then.")
    ).toBeVisible();
  },
};
