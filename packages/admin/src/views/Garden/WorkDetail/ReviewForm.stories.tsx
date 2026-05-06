import type { Address, Work } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FIXTURE_IMAGE_AGROFORESTRY, daysAgo } from "../../../../../shared/.storybook/fixtures";
import { withAdminIdentity } from "../../../../../shared/.storybook/decorators";
import { ReviewForm } from "./ReviewForm";

const GARDENER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0x2222222222222222222222222222222222222222" as Address;

const BASE_WORK: Work = {
  id: "work-1",
  title: "Planted 50 native saplings",
  actionUID: 42,
  gardenerAddress: GARDENER,
  gardenAddress: GARDEN,
  feedback: "",
  metadata: "{}",
  media: [FIXTURE_IMAGE_AGROFORESTRY],
  createdAt: daysAgo(2),
  status: "pending",
};

const APPROVED_WORK: Work = { ...BASE_WORK, status: "approved" };

// Far-future `actionEndTime` keeps the action considered "active". Stories
// that need the expired state override this explicitly.
const ACTIVE_ACTION_END = 4_102_444_800; // 2100-01-01

const meta: Meta<typeof ReviewForm> = {
  title: "Admin/Workflows/Hub/ReviewForm",
  component: ReviewForm,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Operator review form for a work submission. Real component wired through `useWorkApproval` with a mock auth identity + mock wagmi connector, so render states (blocked / actionable / reviewed / expired) are real but the submit path is inert.",
      },
    },
  },
  decorators: [
    withAdminIdentity,
    (Story) => (
      <div className="mx-auto max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    work: BASE_WORK,
    gardenName: "Rio Rainforest Lab",
    actionSlug: "agro.planting_event",
    actionEndTime: ACTIVE_ACTION_END,
    canReview: true,
    canApproveOrReject: true,
    isReviewed: false,
    layout: "sheet",
    onSuccess: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ReviewForm>;

export const Actionable: Story = {};

export const NoPermission: Story = {
  args: {
    canReview: false,
    canApproveOrReject: false,
  },
};

export const RoleBlocked: Story = {
  args: {
    canReview: true,
    canApproveOrReject: false,
  },
};

export const ActionExpired: Story = {
  args: {
    actionEndTime: 1_577_836_800, // 2020-01-01
  },
};

export const AlreadyReviewed: Story = {
  args: {
    work: APPROVED_WORK,
    isReviewed: true,
  },
};
