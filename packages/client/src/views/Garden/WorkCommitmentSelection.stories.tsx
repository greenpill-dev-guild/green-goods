import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { useState } from "react";
import { WorkCommitmentSelection } from "./WorkCommitmentSelection";

type Props = Parameters<typeof WorkCommitmentSelection>[0];
function Picker(props: Props) {
  const [selectedKey, setSelectedKey] = useState(props.selectedKey);
  return (
    <WorkCommitmentSelection
      {...props}
      selectedKey={selectedKey}
      onSelectedKeyChange={setSelectedKey}
    />
  );
}

const meta: Meta<typeof WorkCommitmentSelection> = {
  title: "Client/Work/WorkCommitmentSelection",
  component: WorkCommitmentSelection,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  // Exact requirement fixtures contain BigInts; they are exercised through the picker.
  argTypes: { choices: { control: false } },
  args: {
    choices: [
      {
        key: "9:0",
        commitmentId: 9n,
        requirementIndex: 0,
        title: "Restore the north beds before the autumn planting",
        actionTitle: "Plant seedlings",
        approvedCount: 1,
        requiredCount: 3,
        dueDate: 1791331200n,
      },
      {
        key: "9:1",
        commitmentId: 9n,
        requirementIndex: 1,
        title: "Restore the north beds before the autumn planting",
        actionTitle: "Plant seedlings",
        approvedCount: 0,
        requiredCount: 2,
      },
    ],
    isLoading: false,
    error: null,
    intentStatus: "none",
    selectedKey: null,
    onRetry: fn(),
  },
  render: (args) => <Picker {...args} />,
};
export default meta;
type Story = StoryObj<typeof WorkCommitmentSelection>;
export const ChoosePromise: Story = {};
export const ExactRequirementSelected: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "Choose a Promise" })
    ).toHaveAccessibleDescription(
      "Restore the north beds before the autumn planting Requirement 2 · Plant seedlings · 0 of 2 approved"
    );
  },
  args: { selectedKey: "9:1", intentStatus: "valid" },
};
export const EligibilityUnavailable: Story = {
  args: { intentStatus: "unavailable", error: new Error("Read unavailable") },
};
export const NoMatchingPromises: Story = { args: { choices: [] } };
