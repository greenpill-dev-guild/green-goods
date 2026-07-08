import { type Action, Domain } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { SubmitWorkReview } from "./SubmitWorkReview";

const ACTION: Action = {
  id: "42161-1",
  slug: "agro.canopy_baseline",
  title: "Canopy baseline",
  startTime: 0,
  endTime: 0,
  instructions: "Document baseline canopy cover for the plot.",
  capitals: [],
  media: [],
  domain: Domain.AGRO,
  createdAt: 0,
  description: "Document baseline canopy cover.",
  inputs: [
    {
      key: "plot",
      title: "Plot code",
      placeholder: "Plot A",
      type: "text",
      required: true,
      options: [],
    },
  ],
  mediaInfo: { title: "Field photos", required: true, minImageCount: 1, maxImageCount: 3 },
};

const meta = {
  title: "Admin/Workflows/Garden/SubmitWorkReview",
  component: SubmitWorkReview,
  tags: ["autodocs"],
  args: {
    action: ACTION,
    images: [],
    photoRequirementText: "1 photo required",
    values: {},
  },
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
  parameters: {
    docs: {
      description: {
        component:
          "Read-only summary shown on the final Review step of Submit Work — action, details, " +
          "time & notes, and photos, built from admin Surface + M3 tokens.",
      },
    },
  },
} satisfies Meta<typeof SubmitWorkReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filled: Story = {
  args: {
    values: {
      plot: "Plot A",
      timeSpentMinutes: 2.5,
      feedback: "Cleared the south bed and logged regrowth.",
    },
  },
};

export const Empty: Story = {
  args: { values: {} },
};
