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

interface HubCanvasStoryProps {
  initialPath?: string;
}

function HubCanvasStory({ initialPath = "/hub/work" }: HubCanvasStoryProps) {
  return <StorybookAdminCanvasRoute initialPath={initialPath} />;
}

const meta: Meta<typeof HubCanvasStory> = {
  title: "Admin/Workspaces/Hub",
  component: HubCanvasStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Seeded Hub workspace coverage through the real CanvasLayout shell, including work queue, assess, certify, history, and route-backed detail entry points.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof HubCanvasStory>;

function hubDecorators() {
  return [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "hub",
    }),
  ];
}

export const WorkQueue: Story = {
  tags: ["storybook-ci"],
  args: { initialPath: "/hub/work?sort=newest" },
  decorators: hubDecorators(),
  play: async ({ canvasElement }) => {
    await withTemporaryDocumentTheme("dark", async () => {
      const canvas = within(canvasElement);
      await expect(
        await canvas.findByRole("heading", { name: "Hub" }, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
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
  args: { initialPath: "/hub/work/work-rio-canopy-1?sort=newest" },
  decorators: hubDecorators(),
};

export const SubmitWorkSheet: Story = {
  args: { initialPath: "/hub/work/submit?sort=newest" },
  decorators: hubDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const leftSheet = await canvas.findByTestId(
      "left-sheet",
      undefined,
      ADMIN_ROUTE_STORY_QUERY_OPTIONS
    );
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(
      await within(leftSheet).findByText("Submit Work", undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    ).toBeVisible();
  },
};

export const AssessQueue: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/hub/assess?sort=newest" },
  decorators: hubDecorators(),
};

export const CreateAssessmentRoute: Story = {
  args: { initialPath: "/hub/assess/create?sort=newest" },
  decorators: hubDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole(
        "heading",
        { name: "Submit assessment" },
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
  },
};

export const CertificationInspector: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/hub/certify/assessment-rio-canopy?sort=newest" },
  decorators: hubDecorators(),
};

export const CreateHypercertRoute: Story = {
  args: { initialPath: "/hub/certify/create?sort=newest" },
  decorators: hubDecorators(),
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

export const History: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/hub/history?sort=newest" },
  decorators: hubDecorators(),
};

export const HistoryDetail: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/hub/history/assessment-assessment-rio-canopy?sort=newest" },
  decorators: hubDecorators(),
};
