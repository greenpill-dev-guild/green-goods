import type { Meta, StoryObj } from "@storybook/react";
import { withRouter } from "../../../../../../shared/.storybook/decorators";
import { STORY_GARDEN } from "../poolStoryFixtures";
import { CommitmentDialogLoading, CommitmentDialogNotFound } from "./CommitmentDialogStates";

const meta: Meta<typeof CommitmentDialogNotFound> = {
  title: "Admin/Pool/CommitmentDialogStates",
  component: CommitmentDialogNotFound,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The commitment panel before it has a commitment to show: skeletons while the record and its timeline are in flight, and a retry plus a way back to the pool when it cannot be read at all.",
      },
    },
  },
  args: { garden: STORY_GARDEN, onRetry: () => undefined },
  decorators: [
    withRouter(["/garden"]),
    (Story) => (
      <div className="max-w-xl" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentDialogNotFound>;

export const NotFound: Story = {};

export const Loading: Story = {
  render: () => <CommitmentDialogLoading />,
};
