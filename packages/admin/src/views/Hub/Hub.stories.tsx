import type { Meta, StoryObj } from "@storybook/react";
import { Route, Routes } from "react-router-dom";
import { expect, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withCanvasFrame,
  withRouter,
  withSeededQueryClient,
  withSelectedAdminGarden,
} from "../../../../shared/.storybook/decorators";
import { CanvasLayout } from "@/components/Layout/CanvasLayout";
import Hub from "./index";

function HubCanvasStory() {
  return (
    <Routes>
      <Route element={<CanvasLayout />}>
        <Route path="/hub/work" element={<Hub />} />
        <Route path="/hub/work/:workId" element={<Hub />} />
        <Route path="/hub/assess" element={<Hub />} />
        <Route path="/hub/certify" element={<Hub />} />
        <Route path="/hub/certify/:assessmentId" element={<Hub />} />
        <Route path="/hub/history" element={<Hub />} />
        <Route path="/hub/history/:historyEventId" element={<Hub />} />
      </Route>
    </Routes>
  );
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

function hubDecorators(initialPath: string) {
  return [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withRouter([initialPath]),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "hub",
    }),
  ];
}

export const WorkQueue: Story = {
  tags: ["storybook-ci"],
  render: () => <HubCanvasStory />,
  decorators: hubDecorators("/hub/work?sort=newest"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Work" })).toBeVisible();
    await expect(await canvas.findByText("Canopy transect upload")).toBeVisible();
  },
};

export const WorkDetail: Story = {
  tags: ["visual-harness"],
  render: () => <HubCanvasStory />,
  decorators: hubDecorators("/hub/work/work-rio-canopy-1?sort=newest"),
};

export const AssessQueue: Story = {
  tags: ["visual-harness"],
  render: () => <HubCanvasStory />,
  decorators: hubDecorators("/hub/assess?sort=newest"),
};

export const CertificationInspector: Story = {
  tags: ["visual-harness"],
  render: () => <HubCanvasStory />,
  decorators: hubDecorators("/hub/certify/assessment-rio-canopy?sort=newest"),
};

export const History: Story = {
  tags: ["visual-harness"],
  render: () => <HubCanvasStory />,
  decorators: hubDecorators("/hub/history?sort=newest"),
};

export const HistoryDetail: Story = {
  tags: ["visual-harness"],
  render: () => <HubCanvasStory />,
  decorators: hubDecorators("/hub/history/assessment-assessment-rio-canopy?sort=newest"),
};
