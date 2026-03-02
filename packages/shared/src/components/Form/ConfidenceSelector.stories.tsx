import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Confidence } from "../../types/domain";
import { ConfidenceSelector } from "./ConfidenceSelector";

const meta: Meta<typeof ConfidenceSelector> = {
  title: "Form Controls/ConfidenceSelector",
  component: ConfidenceSelector,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A 4-segment radio group for selecting verification confidence level (None, Low, Medium, High). Supports keyboard navigation with arrow keys. When disabled, defaults to None for rejections.",
      },
    },
  },
  argTypes: {
    value: {
      control: "select",
      options: [Confidence.NONE, Confidence.LOW, Confidence.MEDIUM, Confidence.HIGH],
      mapping: {
        [Confidence.NONE]: Confidence.NONE,
        [Confidence.LOW]: Confidence.LOW,
        [Confidence.MEDIUM]: Confidence.MEDIUM,
        [Confidence.HIGH]: Confidence.HIGH,
      },
      description: "Selected confidence level (0=None, 1=Low, 2=Medium, 3=High)",
    },
    disabled: {
      control: "boolean",
      description: "Disables all radio buttons (used for rejections)",
    },
    required: {
      control: "boolean",
      description: "Marks the field as required via aria-required",
    },
    className: {
      control: "text",
      description: "Additional CSS classes for the container",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ConfidenceSelector>;

export const Default: Story = {
  args: {
    value: Confidence.NONE,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <ConfidenceSelector {...args} value={value} onChange={setValue} />;
  },
};

export const HighConfidence: Story = {
  args: {
    value: Confidence.HIGH,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <ConfidenceSelector {...args} value={value} onChange={setValue} />;
  },
};

export const Disabled: Story = {
  args: {
    value: Confidence.NONE,
    disabled: true,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <ConfidenceSelector {...args} value={value} onChange={setValue} />;
  },
  parameters: {
    docs: {
      description: {
        story: "Disabled state used for rejection workflows where confidence is not applicable.",
      },
    },
  },
};

export const Required: Story = {
  args: {
    value: Confidence.NONE,
    required: true,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <ConfidenceSelector {...args} value={value} onChange={setValue} />;
  },
  parameters: {
    docs: {
      description: {
        story: "Required state used for approval workflows — user must select Low or higher.",
      },
    },
  },
};

export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    value: Confidence.MEDIUM,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <ConfidenceSelector {...args} value={value} onChange={setValue} />;
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <p className="text-sm font-semibold text-text-sub-600 mb-2">None selected</p>
        <ConfidenceSelector value={Confidence.NONE} onChange={() => {}} />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-sub-600 mb-2">Low confidence</p>
        <ConfidenceSelector value={Confidence.LOW} onChange={() => {}} />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-sub-600 mb-2">Medium confidence</p>
        <ConfidenceSelector value={Confidence.MEDIUM} onChange={() => {}} />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-sub-600 mb-2">High confidence</p>
        <ConfidenceSelector value={Confidence.HIGH} onChange={() => {}} />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-sub-600 mb-2">Disabled</p>
        <ConfidenceSelector value={Confidence.NONE} onChange={() => {}} disabled />
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    value: Confidence.NONE,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <ConfidenceSelector {...args} value={value} onChange={setValue} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the radio group is present
    const radioGroup = canvas.getByRole("radiogroup");
    await expect(radioGroup).toBeInTheDocument();

    // Initially "None" should be selected
    const noneButton = canvas.getByRole("radio", { name: /none confidence/i });
    await expect(noneButton).toHaveAttribute("aria-checked", "true");

    // Click "High" to select it
    const highButton = canvas.getByRole("radio", { name: /high confidence/i });
    await userEvent.click(highButton);
    await expect(highButton).toHaveAttribute("aria-checked", "true");

    // Verify hint text updated
    const hint = canvas.getByText("Very confident in outcome");
    await expect(hint).toBeInTheDocument();

    // Click "Medium"
    const mediumButton = canvas.getByRole("radio", { name: /medium confidence/i });
    await userEvent.click(mediumButton);
    await expect(mediumButton).toHaveAttribute("aria-checked", "true");

    // Verify hint text updated
    const mediumHint = canvas.getByText("Reasonably confident");
    await expect(mediumHint).toBeInTheDocument();
  },
};
