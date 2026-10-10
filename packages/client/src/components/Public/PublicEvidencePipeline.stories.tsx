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
      title="From need to learning, season after season."
      titleId="story-pipeline-title"
      intro="Each Garden moves through four stages and starts again. The cycle is what turns a place's needs into something the public can verify."
    />
  ),
};

export const NoIntro: Story = {
  render: () => <PublicEvidencePipeline title="The cycle." titleId="story-pipeline-no-intro" />,
};
