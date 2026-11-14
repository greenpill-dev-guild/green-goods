import type { Meta, StoryObj } from "@storybook/react";
import { GardenAlertsCard } from "@/views/Garden/components/GardenAlertsCard";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import { GardenKeyMetrics, GardenScene } from "./GardenScene";
import { buildScenario } from "./scenarios";
import { GardenTabLayout } from "./SceneFrames";

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/GardenScene",
  component: GardenScene,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Proposed, Storybook only: what every walkthrough Garden screen shares. The cockpit's frame, the Garden header with its stats, actions and tabs, the tab's report scope, the review queue with the alert the shipped rule raises, and the records dialog its content opens.",
      },
    },
  },
  decorators: [
    withCanvasFrame({ workspace: "garden", className: "p-0", heightClassName: "h-screen" }),
  ],
  args: {
    dataset: buildScenario("compost-backlog"),
    media: REPORTING_LAB_MEDIA,
    view: "health",
  },
} satisfies Meta<typeof GardenScene>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The shell with the shipped alerts and Key Metrics, as a tab would fill it. */
export const WithAlertsAndMetrics: Story = {
  args: {
    children: ({ alerts, health, gardeners }) => (
      <GardenTabLayout
        main={
          <GardenKeyMetrics
            dataset={buildScenario("compost-backlog")}
            health={health}
            gardeners={gardeners}
          />
        }
        rail={<GardenAlertsCard alerts={alerts} />}
      />
    ),
  },
};
