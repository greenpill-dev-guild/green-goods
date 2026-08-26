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
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent(/exactly 100 %/);
    // The group-level error is programmatically associated: every share field
    // is marked invalid and described by the container that holds the alert.
    const gardeners = canvas.getByLabelText(/^Gardeners/);
    await expect(gardeners).toHaveAttribute("aria-invalid", "true");
    const describedBy = gardeners.getAttribute("aria-describedby") ?? "";
    await expect(
      describedBy
        .split(/\s+/)
        .some((id) => id && canvasElement.ownerDocument.getElementById(id)?.contains(alert))
    ).toBe(true);
    await userEvent.clear(gardeners);
    await userEvent.type(gardeners, "60");
    await expect(await canvas.findByText("Total: 100 %")).toBeVisible();
    await expect(canvas.getByLabelText(/^Gardeners/)).not.toHaveAttribute("aria-invalid");
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
