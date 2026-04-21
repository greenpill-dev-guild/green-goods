import type { ActionInstructionConfig } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ReviewConfigSection } from "./ReviewConfigSection";

type ReviewConfig = ActionInstructionConfig["uiConfig"]["review"];

function ReviewConfigHarness({ initial }: { initial: ReviewConfig }) {
  const [config, setConfig] = useState<ReviewConfig>(initial);
  return <ReviewConfigSection config={config} onChange={setConfig} />;
}

const meta: Meta<typeof ReviewConfigHarness> = {
  title: "Admin/Workflows/Action/ReviewConfigSection",
  component: ReviewConfigHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Minimal configuration for the review screen copy shown to a gardener before they submit an action.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ReviewConfigHarness>;

export const Empty: Story = {
  args: { initial: { title: "", description: "" } },
};

export const Populated: Story = {
  args: {
    initial: {
      title: "Review & Submit",
      description: "Make sure your photos and details are correct before submitting.",
    },
  },
};
