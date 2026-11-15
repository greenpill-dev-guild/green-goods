import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withCanvasFrame,
  withSeededQueryClient,
  withSelectedAdminGarden,
} from "../../../../shared/.storybook/decorators";
import {
  ADMIN_ROUTE_STORY_QUERY_OPTIONS,
  StorybookAdminCanvasRoute,
} from "../storybookCanvasHarness";
import {
  expectAdminShellDarkPalette,
  withTemporaryDocumentTheme,
} from "../storybookPaletteAssertions";

interface ReviewCanvasStoryProps {
  initialPath?: string;
}

function ReviewCanvasStory({ initialPath = "/review/work" }: ReviewCanvasStoryProps) {
  return <StorybookAdminCanvasRoute initialPath={initialPath} />;
}

const meta: Meta<typeof ReviewCanvasStory> = {
  title: "Admin/Workspaces/Review",
  component: ReviewCanvasStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Seeded Review workspace coverage through the real CanvasLayout shell, including the Work, Confirm, Assessments and Hypercerts tabs and route-backed detail entry points.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ReviewCanvasStory>;

function reviewDecorators() {
  return [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "review",
    }),
  ];
}

// The Confirm stage (W13) on the Review rail; empty here because the seeded
// stewarded gardens hold nothing waiting for confirmation.
export const ConfirmQueue: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/review/confirm" },
  decorators: reviewDecorators(),
};

export const WorkQueue: Story = {
  // Not in storybook-ci: the work queue needs live indexer data the clean-room CI browser
  // can't reach, so seeded work items ("Canopy transect upload") never render offline. Kept
  // for local/authenticated Storybook review.
  args: { initialPath: "/review/work?sort=newest" },
  decorators: reviewDecorators(),
  play: async ({ canvasElement }) => {
    await withTemporaryDocumentTheme("dark", async () => {
      const canvas = within(canvasElement);
      await expect(
        await canvas.findByRole("heading", { name: "Review" }, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
      ).toBeVisible();
      await expect(
        await canvas.findByRole("tab", { name: /Work/ }, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        await canvas.findByText(
          "Canopy transect upload",
          undefined,
          ADMIN_ROUTE_STORY_QUERY_OPTIONS
        )
      ).toBeVisible();
      await waitFor(() => expectAdminShellDarkPalette(canvasElement));
    });
  },
};

export const WorkDetail: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/review/work/work-rio-canopy-1?sort=newest" },
  decorators: reviewDecorators(),
};

// Submit Work is not a Review left sheet: it opens from its route item
// (item=submit-work → ReviewFlowDialogs). Its states are covered by
// SubmitWork.stories.tsx (full-screen dialog / page / inline panel).

// The shell reads its garden from the URL, so a story that shows the seeded
// garden's records names that garden in its path.
const SEEDED_GARDEN = `gardenId=${STORYBOOK_PRIMARY_ADMIN_GARDEN.id}`;

// Approved work is a scope of the Work tab, carried in the URL.
export const ApprovedWork: Story = {
  tags: ["visual-harness"],
  args: { initialPath: `/review/work?${SEEDED_GARDEN}&sort=newest&scope=approved` },
  decorators: reviewDecorators(),
};

export const AssessmentsTab: Story = {
  tags: ["visual-harness"],
  args: { initialPath: `/review/assess?${SEEDED_GARDEN}` },
  decorators: reviewDecorators(),
};

export const CreateAssessmentRoute: Story = {
  args: { initialPath: "/review/assess?sort=newest&item=create-assessment" },
  decorators: reviewDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole(
        "heading",
        { name: "Create Assessment" },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
  },
};

// An assessment's record opens under the Assessments tab.
export const AssessmentRecord: Story = {
  tags: ["visual-harness"],
  args: { initialPath: `/review/assess/assessment-rio-canopy?${SEEDED_GARDEN}` },
  decorators: reviewDecorators(),
};

export const HypercertsTab: Story = {
  tags: ["visual-harness"],
  args: { initialPath: `/review/certify?${SEEDED_GARDEN}` },
  decorators: reviewDecorators(),
};

export const CreateHypercertRoute: Story = {
  args: { initialPath: "/review/certify?sort=newest&item=create-hypercert" },
  decorators: reviewDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole(
        "heading",
        { name: "Create Hypercert" },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
  },
};

// The History stage is retired (2026-08-25 AD-3): /review/history and its
// detail deep links redirect to Review's default stage, so the retired
// stage keeps no stories.
