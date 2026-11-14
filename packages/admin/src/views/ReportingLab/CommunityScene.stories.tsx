import type { Meta, StoryObj } from "@storybook/react";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import { CommunityScene } from "./CommunityScene";
import { buildScenario } from "./scenarios";

const backlog = buildScenario("compost-backlog");

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Walkthrough/Community",
  component: CommunityScene,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Proposed, Storybook only: Community's Members and Endowment tabs. Participation sits above the Member Directory, and the funding history fills the Endowment tab beside Endowment Status. The cards around them follow the shipped tabs, filled from the sample garden. Sample data fixed at Jan 16, 2026.",
      },
    },
  },
  decorators: [
    withCanvasFrame({ workspace: "community", className: "p-0", heightClassName: "h-screen" }),
  ],
  args: { dataset: backlog, media: REPORTING_LAB_MEDIA },
} satisfies Meta<typeof CommunityScene>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Who is taking part each week, and who has gone quiet, above the Member Directory. */
export const Members: Story = { args: { view: "members" } };

/** What came in, went out and is held, per asset, beside Endowment Status. */
export const Endowment: Story = { args: { view: "endowment" } };
