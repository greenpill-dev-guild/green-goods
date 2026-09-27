import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import {
  useGardenJoinRequestAvailability,
  useGardenJoinRequests,
} from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import type { GardenJoinRequestQueueItem } from "@green-goods/shared/public-contracts/join-requests";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { CommunityJoinRequests } from "./CommunityJoinRequests";

const meta = {
  title: "Admin/Workflows/Community/Join Requests",
  component: CommunityJoinRequests,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    withSeededQueryClient([[queryKeys.gardenJoinRequests.availability(), { enabled: true }]]),
  ],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Steward review queue for pending garden membership requests. Loading is explicit so opening the members workspace never triggers a signature prompt.",
      },
    },
  },
  args: {
    gardenAddress: "0x1111111111111111111111111111111111111111",
  },
} satisfies Meta<typeof CommunityJoinRequests>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadyToCheck: Story = {};

type JoinRequests = ReturnType<typeof useGardenJoinRequests>;
const IDLE = { isLoading: false, error: null };

/** The steward's queue after Check Requests, with every write a no-op. */
function joinRequests(overrides: Partial<JoinRequests> = {}): JoinRequests {
  return {
    accountAddress: "0x2222222222222222222222222222222222222222",
    request: null,
    hasCheckedStatus: false,
    queue: [],
    nextCursor: undefined,
    rateLimitedRecently: false,
    statusState: IDLE,
    queueState: IDLE,
    mutationState: IDLE,
    checkStatus: fn(async () => null),
    submitRequest: fn(async () => undefined) as unknown as JoinRequests["submitRequest"],
    withdrawRequest: fn(async () => undefined) as unknown as JoinRequests["withdrawRequest"],
    loadQueue: fn(async () => undefined) as unknown as JoinRequests["loadQueue"],
    resolveRequest: fn(async () => undefined) as unknown as JoinRequests["resolveRequest"],
    ...overrides,
  };
}

function queueItem(overrides: Partial<GardenJoinRequestQueueItem>): GardenJoinRequestQueueItem {
  return {
    id: "join-request-1",
    kind: "garden_membership",
    state: "pending",
    revision: 1,
    requestedVia: "garden_detail",
    requestedAt: "2026-09-20T09:30:00.000Z",
    expiresAt: "2026-10-04T09:30:00.000Z",
    canAskAgain: false,
    accountAddress: "0x3333333333333333333333333333333333333333",
    displayName: "Ada Okafor",
    ...overrides,
  };
}

function withJoinRequests(overrides: Partial<JoinRequests> = {}) {
  return () => {
    mocked(useGardenJoinRequestAvailability).mockReturnValue(true);
    mocked(useGardenJoinRequests).mockReturnValue(joinRequests(overrides));
    return resetHookMocks(useGardenJoinRequestAvailability, useGardenJoinRequests);
  };
}

async function checkRequests(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByRole("button", { name: "Check Requests" }));
  return canvas;
}

/** A checked queue with nobody waiting says so, instead of an empty card. */
export const NoPendingRequests: Story = {
  tags: ["storybook-ci"],
  beforeEach: withJoinRequests(),
  play: async ({ canvasElement }) => {
    const canvas = await checkRequests(canvasElement);
    await expect(await canvas.findByText("There are no pending join requests.")).toBeVisible();
  },
};

/** Two people waiting, one with a note: each row offers Welcome and Decline. */
export const PendingRequests: Story = {
  tags: ["storybook-ci"],
  beforeEach: withJoinRequests({
    queue: [
      queueItem({ note: "I help with the Saturday seed swap and would like to log my work here." }),
      queueItem({
        id: "join-request-2",
        displayName: "Tomás Ribeiro",
        accountAddress: "0x4444444444444444444444444444444444444444",
        requestedAt: "2026-09-22T16:05:00.000Z",
      }),
    ],
  }),
  play: async ({ canvasElement }) => {
    const canvas = await checkRequests(canvasElement);
    await expect(await canvas.findByText("Ada Okafor")).toBeVisible();
    await expect(canvas.getByText("Tomás Ribeiro")).toBeVisible();
    await expect(canvas.getAllByRole("button", { name: "Welcome" })).toHaveLength(2);
    await expect(canvas.getAllByRole("button", { name: "Decline" })).toHaveLength(2);
  },
};

/** When the request service rate-limited recent requests, the queue says so above the list. */
export const RateLimitedRecently: Story = {
  tags: ["storybook-ci"],
  beforeEach: withJoinRequests({ rateLimitedRecently: true }),
  play: async ({ canvasElement }) => {
    const canvas = await checkRequests(canvasElement);
    await expect(
      await canvas.findByText("Some join requests were rate-limited recently.")
    ).toBeVisible();
  },
};
