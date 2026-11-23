import type { Meta, StoryObj } from "@storybook/react";
import type {
  GardenReviewHealth,
  ReviewHealthWeek,
} from "@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController";
import type { Work } from "@green-goods/shared/types/domain";
import { expect, fn, screen, within } from "storybook/test";
import { withAdminIdentity, withRouter } from "../../../../../shared/.storybook/decorators";
import { daysAgo } from "../../../../../shared/.storybook/fixtures";
import { ReviewWeekDialog } from "./ReviewWeekDialog";

const GARDEN = "0x2222222222222222222222222222222222222222";

function storyWork(title: string, status: Work["status"]): Work {
  return {
    id: `0x${title.length.toString(16).padStart(4, "0")}${title.replace(/\W/g, "")}`,
    title,
    actionUID: 1,
    gardenerAddress: "0x1111111111111111111111111111111111111111",
    gardenAddress: GARDEN,
    feedback: "",
    metadata: "{}",
    media: [],
    createdAt: daysAgo(3),
    status,
  };
}

const WEEK: ReviewHealthWeek = {
  start: new Date(2026, 10, 9),
  submitted: [storyWork("Compost turned", "pending"), storyWork("Seedlings planted", "approved")],
  reviewed: [storyWork("Rain barrel fitted", "approved"), storyWork("Path mulched", "rejected")],
  submittedComplete: true,
  reviewedComplete: true,
  reviewedAvailable: true,
  isCurrent: false,
};

function storyHealth(overrides: Partial<GardenReviewHealth>): GardenReviewHealth {
  return {
    weeks: [WEEK],
    state: "ready",
    stale: false,
    refreshFailed: false,
    reviewedAvailable: true,
    isFetching: false,
    retry: fn() as unknown as GardenReviewHealth["retry"],
    openWeek: WEEK,
    openList: "reviewed",
    weekHref: () => "/garden/health",
    handleCloseWeek: fn(),
    ...overrides,
  };
}

const meta = {
  title: "Admin/Workflows/Garden/ReviewWeekDialog",
  component: ReviewWeekDialog,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withRouter()],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "One week of Review Health: what was sent that week, or what got its first decision. A row opens its record in Review.",
      },
    },
  },
  args: {
    gardenId: GARDEN,
    health: storyHealth({}),
    weekLabel: () => "Nov 9",
  },
} satisfies Meta<typeof ReviewWeekDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reviewed: Story = {
  tags: ["storybook-ci"],
  play: async () => {
    const dialog = await screen.findByRole("dialog", { name: "Reviewed the week of Nov 9" });
    // The reviewed list is chosen, and lists the week's first decisions.
    await expect(within(dialog).getByRole("button", { name: "Reviewed (2)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(within(dialog).getByText("Path mulched")).toBeInTheDocument();
  },
};

export const Submitted: Story = { args: { health: storyHealth({ openList: "submitted" }) } };

export const PartlyRead: Story = {
  args: { health: storyHealth({ openWeek: { ...WEEK, reviewedComplete: false } }) },
};

export const QuietWeek: Story = {
  args: { health: storyHealth({ openWeek: { ...WEEK, reviewed: [] } }) },
};
