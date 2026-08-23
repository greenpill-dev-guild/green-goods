import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import {
  ALLOCATION_PRESETS,
  AllocationEditor,
  type AllocationPercent,
  type AllocationPreset,
  DEFAULT_RECOGNITION_PERCENT,
  type RecognitionPercent,
} from "./AllocationEditor";

/** The editor is controlled; the story holds its values. */
function AllocationEditorWithValues(props: ComponentProps<typeof AllocationEditor>) {
  const [preset, setPreset] = useState<AllocationPreset>(props.preset);
  const [allocation, setAllocation] = useState<AllocationPercent>(props.allocation);
  const [recognition, setRecognition] = useState<RecognitionPercent>(props.recognition);
  return (
    <div className="max-w-2xl p-4" data-tone="garden">
      <AllocationEditor
        preset={preset}
        onPresetChange={setPreset}
        allocation={allocation}
        onAllocationChange={setAllocation}
        recognition={recognition}
        onRecognitionChange={setRecognition}
        disabled={props.disabled}
      />
    </div>
  );
}

const meta: Meta<typeof AllocationEditor> = {
  title: "Admin/Pool/AllocationEditor",
  component: AllocationEditor,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The six-role split and the within-gardeners recognition policy in percent, with a basis-points helper. Presets prefill; every field stays editable; the sum must equal 100 % and a treasury share under 15 % warns without blocking.",
      },
    },
  },
  args: {
    preset: "model1",
    allocation: ALLOCATION_PRESETS.model1,
    recognition: DEFAULT_RECOGNITION_PERCENT,
  },
  render: (args) => <AllocationEditorWithValues {...args} />,
};

export default meta;
type Story = StoryObj<typeof AllocationEditor>;

export const Standard: Story = {};

export const InvalidSum: Story = {
  args: { preset: "custom", allocation: { ...ALLOCATION_PRESETS.model1, gardeners: "64" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("alert")).toHaveTextContent(/exactly 100 %/);
    await userEvent.clear(canvas.getByLabelText(/^Gardeners/));
    await userEvent.type(canvas.getByLabelText(/^Gardeners/), "60");
    await expect(await canvas.findByText("Total: 100 %")).toBeVisible();
  },
};

export const LowTreasury: Story = {
  args: {
    preset: "custom",
    allocation: {
      gardeners: "70",
      treasury: "10",
      steward: "10",
      evaluator: "5",
      community: "3",
      funder: "2",
    },
  },
};
