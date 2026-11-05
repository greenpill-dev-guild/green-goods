import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type {
  CommitmentPoolRecord,
  CommitmentsInbox,
  InboxCommitment,
} from "@green-goods/shared/commitment-pooling";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent, within } from "storybook/test";

import {
  STORY_GROUP_METADATA,
  STORY_GROUP_TITLE,
  storyGroup,
} from "@/components/Features/Commitments/promiseGroupStoryFixtures";
import { expectItemRowsFit } from "../../../../../shared/.storybook/itemRowFit";
import {
  withClientAppRuntime,
  withRouter,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import { LiveTab } from "./LiveTab";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

/** The sheet's body hands scrolling to the tab, so the tab needs a column to fill. */
const withSheetBody: Decorator = (Story) => (
  <div className="flex h-dvh min-h-0 flex-col">
    <Story />
  </div>
);

function inbox(live: InboxCommitment[]): CommitmentsInbox {
  return {
    live,
    settled: [],
    liveActCount: 0,
    settledActCount: 0,
    totalActCount: 0,
    availability: { status: "available", capability: {} },
    isLoading: false,
    isError: false,
    failedJobCount: 0,
    failedCommitmentIds: new Set<string>(),
    unlistedFailureCount: 0,
    hasPendingCreate: false,
    queueUnavailable: false,
    refetch: fn(),
  } as unknown as CommitmentsInbox;
}

/** Ten open offers of one promise as their creator reads them, none of them taken up. */
const tenOffers: InboxCommitment[] = storyGroup({
  available: 10,
  overrides: {
    direction: "OFFER",
    onchainState: "OFFERED",
    derivedState: "OFFERED",
    state: "OFFERED",
  },
}).group.children.map((commitment) => ({ commitment, seat: "provider", needsYou: false }));

/**
 * The Live tab of the Promises sheet, in the active garden. Fictional data from the
 * group fixtures.
 */
const meta: Meta<typeof LiveTab> = {
  title: "Client/Commitments/PromisesLiveTab",
  component: LiveTab,
  tags: ["autodocs", "storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  parameters: { layout: "fullscreen" },
  decorators: [
    withSheetBody,
    withSeededQueryClient(
      Array.from(
        STORY_GROUP_METADATA,
        ([cid, metadata]) => [queryKeys.commitmentPooling.metadata(cid), metadata] as const
      )
    ),
    withRouter(["/home"]),
    withClientAppRuntime,
  ],
  args: {
    inbox: inbox(tenOffers),
    pools: [{ poolId: 7n, garden: GARDEN }] as unknown as CommitmentPoolRecord[],
    gardens: [],
    sendsFromTap: false,
    direction: "all",
    onDirectionChange: fn(),
    onOpenCommitment: fn(),
    cycleId: null,
    gardenHeadings: false,
    covered: false,
  },
};

export default meta;
type Story = StoryObj<typeof LiveTab>;

/**
 * Identical open copies are one row with their number on the tile (DL-150), and the row opens
 * a half sheet of the ten, each its own row into its own promise.
 */
export const IdenticalCopies: Story = {
  play: async ({ canvasElement, args }) => {
    const fold = within(canvasElement).getByRole("button", {
      name: /A group of 10 separate promises/,
    });
    await expect(fold).toHaveTextContent("Offered");
    await expectItemRowsFit(canvasElement);
    await userEvent.click(fold);

    const copies = await screen.findByRole("dialog", { name: STORY_GROUP_TITLE });
    await expect(copies).toHaveAttribute("data-sheet-size", "half");
    const rows = within(copies).getAllByRole("button", { name: new RegExp(STORY_GROUP_TITLE) });
    await expect(rows).toHaveLength(10);
    await userEvent.click(rows[0] as HTMLElement);
    await expect(args.onOpenCommitment).toHaveBeenCalledWith(GARDEN, 101n);
  },
};

/** A copy someone took up is its own row: it has its own person and its own progress. */
export const TakenCopyKeepsItsRow: Story = {
  args: {
    inbox: inbox([
      ...tenOffers.slice(0, 3),
      {
        commitment: {
          ...(tenOffers[3] as InboxCommitment).commitment,
          onchainState: "ACCEPTED",
          derivedState: "ACTIVE",
          state: "ACCEPTED",
        },
        seat: "provider",
        needsYou: true,
      },
    ]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: /A group of 3 separate promises/ })
    ).toBeVisible();
    await expect(canvas.getByText("Needs you")).toBeVisible();
    await expectItemRowsFit(canvasElement);
  },
};
