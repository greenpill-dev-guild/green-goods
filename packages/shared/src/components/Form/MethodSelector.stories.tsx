import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent } from "storybook/test";
import { VerificationMethod } from "../../types/domain";
import { MethodSelector } from "./MethodSelector";

const meta: Meta<typeof MethodSelector> = {
  title: "Form Controls/MethodSelector",
  component: MethodSelector,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Multi-select toggle group for verification methods. Uses bitmask values (HUMAN=1, IOT=2, ONCHAIN=4, AGENT=8). Multiple methods can be selected simultaneously via bitwise OR.",
      },
    },
  },
  argTypes: {
    value: {
      control: "number",
      description: "Bitmask value combining selected VerificationMethod flags",
    },
    disabled: {
      control: "boolean",
      description: "Disables all toggle buttons",
    },
    className: {
      control: "text",
      description: "Additional CSS classes for the container",
    },
  },
};

export default meta;
type Story = StoryObj<typeof MethodSelector>;

export const Default: Story = {
  args: {
    value: 0,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <MethodSelector {...args} value={value} onChange={setValue} />;
  },
};

export const SingleSelected: Story = {
  args: {
    value: VerificationMethod.HUMAN,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <MethodSelector {...args} value={value} onChange={setValue} />;
  },
};

export const MultipleSelected: Story = {
  args: {
    value: VerificationMethod.HUMAN | VerificationMethod.IOT,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <MethodSelector {...args} value={value} onChange={setValue} />;
  },
  parameters: {
    docs: {
      description: {
        story:
          "Multiple methods selected simultaneously. Value is a bitmask: HUMAN (1) | IOT (2) = 3.",
      },
    },
  },
};

export const AllSelected: Story = {
  args: {
    value:
      VerificationMethod.HUMAN |
      VerificationMethod.IOT |
      VerificationMethod.ONCHAIN |
      VerificationMethod.AGENT,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <MethodSelector {...args} value={value} onChange={setValue} />;
  },
};

export const Disabled: Story = {
  args: {
    value: VerificationMethod.HUMAN | VerificationMethod.ONCHAIN,
    disabled: true,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <MethodSelector {...args} value={value} onChange={setValue} />;
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
    value: VerificationMethod.HUMAN | VerificationMethod.AGENT,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <MethodSelector {...args} value={value} onChange={setValue} />;
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <p className="text-sm font-semibold text-text-sub-600 mb-2">No methods selected</p>
        <MethodSelector value={0} onChange={() => {}} />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-sub-600 mb-2">Human only</p>
        <MethodSelector value={VerificationMethod.HUMAN} onChange={() => {}} />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-sub-600 mb-2">Human + IoT (bitmask: 3)</p>
        <MethodSelector
          value={VerificationMethod.HUMAN | VerificationMethod.IOT}
          onChange={() => {}}
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-sub-600 mb-2">All methods (bitmask: 15)</p>
        <MethodSelector
          value={
            VerificationMethod.HUMAN |
            VerificationMethod.IOT |
            VerificationMethod.ONCHAIN |
            VerificationMethod.AGENT
          }
          onChange={() => {}}
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-sub-600 mb-2">Disabled</p>
        <MethodSelector
          value={VerificationMethod.HUMAN | VerificationMethod.ONCHAIN}
          onChange={() => {}}
          disabled
        />
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    value: 0,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <MethodSelector {...args} value={value} onChange={setValue} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the group is present
    const group = canvas.getByRole("group");
    await expect(group).toBeInTheDocument();

    // Initially no methods selected — all should be aria-pressed=false
    const humanButton = canvas.getByRole("button", { name: /human verification/i });
    await expect(humanButton).toHaveAttribute("aria-pressed", "false");

    // Select Human
    await userEvent.click(humanButton);
    await expect(humanButton).toHaveAttribute("aria-pressed", "true");

    // Select IoT (Human should remain selected — multi-select)
    const iotButton = canvas.getByRole("button", { name: /iot verification/i });
    await userEvent.click(iotButton);
    await expect(iotButton).toHaveAttribute("aria-pressed", "true");
    await expect(humanButton).toHaveAttribute("aria-pressed", "true");

    // Deselect Human (IoT should remain)
    await userEvent.click(humanButton);
    await expect(humanButton).toHaveAttribute("aria-pressed", "false");
    await expect(iotButton).toHaveAttribute("aria-pressed", "true");
  },
};
