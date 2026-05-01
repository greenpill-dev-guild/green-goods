import type { Meta, StoryObj } from "@storybook/react";
import { PublicEvidencePipeline } from "./PublicEvidencePipeline";

const meta: Meta<typeof PublicEvidencePipeline> = {
  title: "Client/Public/PublicEvidencePipeline",
  component: PublicEvidencePipeline,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The Impact page's anchor figure — the regenerative cycle as " +
          "Assessment → Work → Impact Certificate, with a return arrow indicating " +
          "the loop continues.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PublicEvidencePipeline>;

export const Default: Story = {
  render: () => (
    <PublicEvidencePipeline
      kicker="§ 01 — The cycle"
      title="From plan to public proof, season after season."
      titleId="story-pipeline-title"
      intro="Each Garden moves through three stages of evidence — and starts again. The cycle is what turns a place's intentions into something the public can verify."
    />
  ),
};

export const NoIntro: Story = {
  render: () => (
    <PublicEvidencePipeline title="The evidence cycle." titleId="story-pipeline-no-intro" />
  ),
};
