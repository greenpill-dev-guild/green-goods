import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent } from "storybook/test";
import { DatePicker } from "./DatePicker";

// Fixed timestamps for deterministic stories (2025-06-15 12:00:00 UTC)
const JUNE_15_2025 = 1750003200;
// 2025-01-01 00:00:00 UTC
const JAN_1_2025 = 1735689600;
// 2025-12-31 23:59:59 UTC
const DEC_31_2025 = 1767225599;

const meta: Meta<typeof DatePicker> = {
  title: "Form Controls/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Date picker using react-day-picker with Radix Popover. Values are Unix timestamps in seconds. Styled to match the Green Goods design system.",
      },
    },
  },
  argTypes: {
    value: {
      control: "number",
      description: "Selected date as Unix timestamp (seconds)",
    },
    placeholder: {
      control: "text",
      description: "Placeholder text when no date is selected",
    },
    label: {
      control: "text",
      description: "Label for the input",
    },
    helperText: {
      control: "text",
      description: "Helper text displayed below the input",
    },
    error: {
      control: "text",
      description: "Error message to display",
    },
    minDate: {
      control: "number",
      description: "Minimum selectable date as Unix timestamp (seconds)",
    },
    maxDate: {
      control: "number",
      description: "Maximum selectable date as Unix timestamp (seconds)",
    },
    disabled: {
      control: "boolean",
      description: "Whether the input is disabled",
    },
    required: {
      control: "boolean",
      description: "Whether the field is required (shows asterisk)",
    },
    id: {
      control: "text",
      description: "ID for the input element",
    },
  },
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Default: Story = {
  args: {
    label: "Select Date",
    placeholder: "Choose a date",
    id: "date-default",
  },
  render: function Render(args) {
    const [value, setValue] = useState<number | null>(null);
    return <DatePicker {...args} value={value} onChange={setValue} />;
  },
};

export const WithValue: Story = {
  args: {
    label: "Start Date",
    value: JUNE_15_2025,
    id: "date-with-value",
  },
  render: function Render(args) {
    const [value, setValue] = useState<number | null>(args.value ?? null);
    return <DatePicker {...args} value={value} onChange={setValue} />;
  },
};

export const WithConstraints: Story = {
  args: {
    label: "Event Date",
    placeholder: "Select event date",
    minDate: JAN_1_2025,
    maxDate: DEC_31_2025,
    helperText: "Must be within 2025",
    id: "date-constrained",
  },
  render: function Render(args) {
    const [value, setValue] = useState<number | null>(null);
    return <DatePicker {...args} value={value} onChange={setValue} />;
  },
};

export const WithError: Story = {
  args: {
    label: "Due Date",
    error: "Date must be in the future",
    value: JAN_1_2025,
    id: "date-error",
  },
  render: function Render(args) {
    const [value, setValue] = useState<number | null>(args.value ?? null);
    return <DatePicker {...args} value={value} onChange={setValue} />;
  },
};

export const Required: Story = {
  args: {
    label: "Work Start Date",
    placeholder: "Select start date",
    required: true,
    id: "date-required",
  },
  render: function Render(args) {
    const [value, setValue] = useState<number | null>(null);
    return <DatePicker {...args} value={value} onChange={setValue} />;
  },
};

export const Disabled: Story = {
  args: {
    label: "Locked Date",
    value: JUNE_15_2025,
    disabled: true,
    id: "date-disabled",
  },
  render: function Render(args) {
    const [value, setValue] = useState<number | null>(args.value ?? null);
    return <DatePicker {...args} value={value} onChange={setValue} />;
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
    label: "Dark Mode Date",
    placeholder: "Select date",
    id: "date-dark",
  },
  render: function Render(args) {
    const [value, setValue] = useState<number | null>(null);
    return <DatePicker {...args} value={value} onChange={setValue} />;
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-sm">
      <DatePicker label="Default" placeholder="Select date" id="gallery-default" />
      <DatePicker label="With Value" value={JUNE_15_2025} id="gallery-value" />
      <DatePicker label="Required" placeholder="Select date" required id="gallery-required" />
      <DatePicker
        label="With Helper"
        placeholder="Select date"
        helperText="Choose a date within the project timeline"
        id="gallery-helper"
      />
      <DatePicker
        label="With Error"
        error="This date is in the past"
        value={JAN_1_2025}
        id="gallery-error"
      />
      <DatePicker label="Disabled" value={JUNE_15_2025} disabled id="gallery-disabled" />
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    label: "Pick a Date",
    placeholder: "Click to open calendar",
    id: "date-interactive",
  },
  render: function Render(args) {
    const [value, setValue] = useState<number | null>(null);
    return <DatePicker {...args} value={value} onChange={setValue} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the trigger button is rendered
    const trigger = canvas.getByRole("button", { name: /click to open calendar/i });
    await expect(trigger).toBeInTheDocument();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Open the date picker popover
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // The calendar renders in a portal — verify it appeared
    const portal = within(document.body);
    // DayPicker renders day buttons — find at least one
    const dayButtons = portal.getAllByRole("gridcell");
    await expect(dayButtons.length).toBeGreaterThan(0);
  },
};
