import type { Meta, StoryObj } from "@storybook/react";
import { useMemo } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, within } from "storybook/test";
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
import { CanvasLayout } from "@/components/Layout/CanvasLayout";
import { adminCanvasRoutes } from "@/routes/views";

interface HubCanvasStoryProps {
  initialPath?: string;
}

function HubCanvasStory({ initialPath = "/hub/work" }: HubCanvasStoryProps) {
  const router = useMemo(
    () =>
      createMemoryRouter(
        [
          {
            element: <CanvasLayout />,
            children: adminCanvasRoutes,
          },
        ],
        { initialEntries: [initialPath] }
      ),
    [initialPath]
  );

  return <RouterProvider router={router} />;
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
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Work" })).toBeVisible();
    await expect(await canvas.findByText("Canopy transect upload")).toBeVisible();
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
    const leftSheet = await canvas.findByTestId("left-sheet");
    await expect(leftSheet).toHaveAttribute("data-component", "LeftSheet");
    await expect(await within(leftSheet).findByText("Submit Work")).toBeVisible();
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
    await expect(await canvas.findByRole("heading", { name: "Submit assessment" })).toBeVisible();
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
    await expect(await canvas.findByRole("heading", { name: "Create Hypercert" })).toBeVisible();
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
