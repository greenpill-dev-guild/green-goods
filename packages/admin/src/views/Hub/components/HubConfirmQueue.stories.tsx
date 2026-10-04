import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { useCommitmentJobs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, mocked, screen, userEvent, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_GARDENS,
  STORYBOOK_ADMIN_SHELL_SEEDS,
} from "../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import {
  STORY_GARDEN,
  STORY_GROUP_COPIES,
  STORY_GROUP_METADATA,
  STORY_ROOT_GARDEN,
  STORY_TO_CONFIRM,
} from "../../Garden/Pool/poolStoryFixtures";
import { HubConfirmQueue } from "./HubConfirmQueue";

const meta: Meta<typeof HubConfirmQueue> = {
  title: "Admin/Hub/HubConfirmQueue",
  component: HubConfirmQueue,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "W13, the Hub's Confirm stage for the garden in the header: commitments waiting on its stewards with who committed, the title, the pool a commitment lives in when that is another garden's, N-of-group progress, the eligibility badge and the decision row. Confirm Kept opens a review first. Community → Coordination renders the same queue for the Green Goods team's rows. Loading and read-error never render as an empty queue.",
      },
    },
  },
  args: {
    chainId: DEFAULT_CHAIN_ID,
    normalizedSearch: "",
    selectedCommitmentId: undefined,
    onOpenCommitment: () => undefined,
    onCloseCommitment: () => undefined,
  },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="hub">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof HubConfirmQueue>;

// The queue's rows wait on the commitment titles, which take a moment here.
const ROWS = { timeout: 5000 };
const [ownGroup] = STORY_TO_CONFIRM.groups;
const [ownRow] = ownGroup!.rows;
const otherGarden = STORYBOOK_ADMIN_GARDENS[1]!;

export const Queue: Story = {
  args: { toConfirm: STORY_TO_CONFIRM },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Needs a steward step-in", {}, ROWS)).toBeVisible();
    await expect(await canvas.findByText("1 of 2 confirmed", {}, ROWS)).toBeVisible();
  },
};

/** A commitment this garden confirms, living in another garden's pool, says whose. */
export const InAnotherGardensPool: Story = {
  args: {
    toConfirm: {
      ...STORY_TO_CONFIRM,
      groups: [
        {
          ...ownGroup!,
          rows: [{ ...ownRow!, poolGarden: otherGarden.id, poolGardenName: otherGarden.name }],
        },
      ],
      fallback: [],
      count: 1,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(new RegExp(`in ${otherGarden.name}’s pool`), {}, ROWS)
    ).toBeVisible();
  },
};

/**
 * Community → Coordination's protocol confirmations: the Green Goods team acts,
 * and every row names the garden whose pool the commitment lives in.
 */
export const ProtocolConfirmations: Story = {
  args: {
    toConfirm: {
      ...STORY_TO_CONFIRM,
      groups: [],
      fallback: STORY_TO_CONFIRM.fallback.map((row) => ({
        ...row,
        path: "PROTOCOL_FALLBACK" as const,
        garden: STORY_ROOT_GARDEN,
        gardenName: "Green Goods Community Garden",
        poolGarden: STORY_GARDEN,
        poolGardenName: ownGroup!.gardenName,
        // Only that pool's own steward may raise a dispute there.
        canDispute: false,
      })),
      disputed: [],
      count: STORY_TO_CONFIRM.fallback.length,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Needs the Green Goods team", {}, ROWS)).toBeVisible();
    await expect(
      await canvas.findByText(new RegExp(`in ${ownGroup!.gardenName}’s pool`), {}, ROWS)
    ).toBeVisible();
  },
};

/** Confirm Kept opens the review; nothing is sent from the row itself. */
export const ConfirmKeptReview: Story = {
  args: { toConfirm: { ...STORY_TO_CONFIRM, fallback: [], count: 1 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Confirm Kept…" }, ROWS));
    const review = await screen.findByRole("dialog", { name: "Confirm This Commitment Kept" });
    await expect(review).toHaveTextContent("This closes the commitment as kept, for everyone.");
  },
};

/**
 * Two copies of one group waiting on this garden: each is its own row, named
 * by its group, and each is confirmed on its own. Nothing confirms them all.
 */
// The indexer gives every copy its pool; the shared story copies leave it out.
const groupPoolId = 7n;
const readyCopies = STORY_GROUP_COPIES.map((copy) => ({
  ...copy,
  poolId: groupPoolId,
  ...(copy.commitmentId === 26n
    ? {
        onchainState: "READY_FOR_CONFIRMATION" as const,
        derivedState: "READY_FOR_CONFIRMATION" as const,
      }
    : {}),
}));
export const CopiesFromAGroup: Story = {
  tags: ["storybook-ci"],
  args: {
    toConfirm: {
      ...STORY_TO_CONFIRM,
      groups: [
        {
          ...ownGroup!,
          rows: readyCopies
            .filter((copy) => copy.onchainState === "READY_FOR_CONFIRMATION")
            .map((commitment) => ({ commitment, seat: "confirmer" as const, needsYou: true })),
        },
      ],
      fallback: [],
      count: 2,
    },
  },
  decorators: [
    withSeededQueryClient([
      ...STORYBOOK_ADMIN_SHELL_SEEDS,
      [
        queryKeys.commitmentPooling.commitments(DEFAULT_CHAIN_ID, {
          chainId: DEFAULT_CHAIN_ID,
          poolId: groupPoolId,
        }),
        readyCopies,
      ],
      [queryKeys.commitmentPooling.metadata(readyCopies[0]!.metadataCID!), STORY_GROUP_METADATA],
    ]),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findAllByText(/from a group of 10/, {}, ROWS)).toHaveLength(2);
    await expect(canvas.getAllByRole("button", { name: "Confirm Kept…" })).toHaveLength(2);
    await expect(canvas.queryByRole("button", { name: /Confirm All/i })).toBeNull();
  },
};

/**
 * A confirmation that lands turns its row into the outcome, in place, with
 * its time: it stays there for the visit, the way Review Promises does.
 */
export const ConfirmedInPlace: Story = {
  tags: ["storybook-ci"],
  args: { toConfirm: { ...STORY_TO_CONFIRM, fallback: [], count: 1 } },
  beforeEach: () => {
    mocked(useCommitmentJobs).mockReturnValue({
      isPending: false,
      enqueue: async (input: { report?: (event: { stage: "landed"; txHash: null }) => void }) => {
        input.report?.({ stage: "landed", txHash: null });
        return "job-story";
      },
    } as unknown as ReturnType<typeof useCommitmentJobs>);
    return resetHookMocks(useCommitmentJobs);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Confirm Kept…" }, ROWS));
    const review = await screen.findByRole("dialog", { name: "Confirm This Commitment Kept" });
    await userEvent.click(within(review).getByRole("button", { name: "Confirm Kept" }));
    await expect(await canvas.findByText("Confirmed", {}, ROWS)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Confirm Kept…" })).toBeNull();
  },
};

export const Empty: Story = {
  args: { toConfirm: { ...STORY_TO_CONFIRM, groups: [], fallback: [], count: 0 } },
};

export const Loading: Story = {
  args: { toConfirm: { ...STORY_TO_CONFIRM, groups: [], fallback: [], count: 0, isLoading: true } },
};

export const ReadError: Story = {
  args: { toConfirm: { ...STORY_TO_CONFIRM, groups: [], fallback: [], count: 0, isError: true } },
};
