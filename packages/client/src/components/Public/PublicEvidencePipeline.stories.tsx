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
          "Assessment → Commitment → Work → Confirmation → Impact Certificate, " +
          "with a return arrow indicating the loop continues. Node copy is " +
          "localized; Commitment and Confirmation are narrative stages, not " +
          "evidence-ledger record kinds.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PublicEvidencePipeline>;

export const Default: Story = {
  render: () => (
    <PublicEvidencePipeline
      kicker="§ 03: The cycle"
      title="From plan to public proof, season after season."
      titleId="story-pipeline-title"
      intro="Each Garden moves through five stages of evidence and starts again. The cycle is what turns a place's intentions into something the public can verify."
    />
  ),
};

export const NoIntro: Story = {
  render: () => (
    <PublicEvidencePipeline title="The evidence cycle." titleId="story-pipeline-no-intro" />
  ),
};
