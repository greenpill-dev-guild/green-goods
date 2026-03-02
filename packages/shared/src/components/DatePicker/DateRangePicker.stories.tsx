import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { DateRangePicker } from "./DateRangePicker";

// Fixed timestamps for deterministic stories
// 2025-06-01 00:00:00 UTC
const JUNE_1_2025 = 1748736000;
// 2025-06-30 23:59:59 UTC
const JUNE_30_2025 = 1751327999;
// 2025-01-01 00:00:00 UTC
const JAN_1_2025 = 1735689600;
// 2025-12-31 23:59:59 UTC
const DEC_31_2025 = 1767225599;

const meta: Meta<typeof DateRangePicker> = {
  title: "Form Controls/DateRangePicker",
  component: DateRangePicker,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Date range picker for selecting start and end dates. Uses react-day-picker in range mode with Radix Popover. Values are Unix timestamps in seconds. Supports individual or combined change handlers.",
      },
    },
  },
  argTypes: {
    startValue: {
      control: "number",
      description: "Start date as Unix timestamp (seconds)",
    },
    endValue: {
      control: "number",
      description: "End date as Unix timestamp (seconds)",
    },
    startPlaceholder: {
      control: "text",
      description: "Placeholder for start date",
    },
    endPlaceholder: {
      control: "text",
      description: "Placeholder for end date",
    },
    label: {
      control: "text",
      description: "Label for the field group",
    },
    helperText: {
      control: "text",
      description: "Helper text displayed below the inputs",
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
      description: "Whether the inputs are disabled",
    },
    required: {
      control: "boolean",
      description: "Whether the field is required (shows asterisk)",
    },
    numberOfMonths: {
      control: "select",
      options: [1, 2],
      description: "Number of months to display in the calendar",
    },
    id: {
      control: "text",
      description: "ID prefix for the input elements",
    },
  },
};

export default meta;
type Story = StoryObj<typeof DateRangePicker>;

export const Default: Story = {
  args: {
    label: "Work Timeframe",
    id: "range-default",
  },
  render: function Render(args) {
    const [start, setStart] = useState<number | null>(null);
    const [end, setEnd] = useState<number | null>(null);
    return (
      <DateRangePicker
        {...args}
        startValue={start}
        endValue={end}
        onRangeChange={(s, e) => {
          setStart(s);
          setEnd(e);
        }}
      />
    );
  },
};

export const WithValue: Story = {
  args: {
    label: "Project Duration",
    startValue: JUNE_1_2025,
    endValue: JUNE_30_2025,
    id: "range-with-value",
  },
  render: function Render(args) {
    const [start, setStart] = useState<number | null>(args.startValue ?? null);
    const [end, setEnd] = useState<number | null>(args.endValue ?? null);
    return (
      <DateRangePicker
        {...args}
        startValue={start}
        endValue={end}
        onRangeChange={(s, e) => {
          setStart(s);
          setEnd(e);
        }}
      />
    );
  },
};

export const WithConstraints: Story = {
  args: {
    label: "Report Period",
    minDate: JAN_1_2025,
    maxDate: DEC_31_2025,
    helperText: "Select a range within 2025",
    id: "range-constrained",
  },
  render: function Render(args) {
    const [start, setStart] = useState<number | null>(null);
    const [end, setEnd] = useState<number | null>(null);
    return (
      <DateRangePicker
        {...args}
        startValue={start}
        endValue={end}
        onRangeChange={(s, e) => {
          setStart(s);
          setEnd(e);
        }}
      />
    );
  },
};

export const WithError: Story = {
  args: {
    label: "Work Timeframe",
    error: "End date must be after start date",
    startValue: JUNE_30_2025,
    endValue: JUNE_1_2025,
    id: "range-error",
  },
  render: function Render(args) {
    const [start, setStart] = useState<number | null>(args.startValue ?? null);
    const [end, setEnd] = useState<number | null>(args.endValue ?? null);
    return (
      <DateRangePicker
        {...args}
        startValue={start}
        endValue={end}
        onRangeChange={(s, e) => {
          setStart(s);
          setEnd(e);
        }}
      />
    );
  },
};

export const Required: Story = {
  args: {
    label: "Impact Period",
    required: true,
    id: "range-required",
  },
  render: function Render(args) {
    const [start, setStart] = useState<number | null>(null);
    const [end, setEnd] = useState<number | null>(null);
    return (
      <DateRangePicker
        {...args}
        startValue={start}
        endValue={end}
        onRangeChange={(s, e) => {
          setStart(s);
          setEnd(e);
        }}
      />
    );
  },
};

export const SingleMonth: Story = {
  args: {
    label: "Short Range",
    numberOfMonths: 1,
    id: "range-single-month",
  },
  render: function Render(args) {
    const [start, setStart] = useState<number | null>(null);
    const [end, setEnd] = useState<number | null>(null);
    return (
      <DateRangePicker
        {...args}
        startValue={start}
        endValue={end}
        onRangeChange={(s, e) => {
          setStart(s);
          setEnd(e);
        }}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Single-month calendar view, useful for narrow containers or short date ranges.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    label: "Locked Timeframe",
    startValue: JUNE_1_2025,
    endValue: JUNE_30_2025,
    disabled: true,
    id: "range-disabled",
  },
  render: function Render(args) {
    const [start, setStart] = useState<number | null>(args.startValue ?? null);
    const [end, setEnd] = useState<number | null>(args.endValue ?? null);
    return (
      <DateRangePicker
        {...args}
        startValue={start}
        endValue={end}
        onRangeChange={(s, e) => {
          setStart(s);
          setEnd(e);
        }}
      />
    );
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
    label: "Dark Mode Range",
    id: "range-dark",
  },
  render: function Render(args) {
    const [start, setStart] = useState<number | null>(null);
    const [end, setEnd] = useState<number | null>(null);
    return (
      <DateRangePicker
        {...args}
        startValue={start}
        endValue={end}
        onRangeChange={(s, e) => {
          setStart(s);
          setEnd(e);
        }}
      />
    );
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-lg">
      <DateRangePicker label="Default" id="gallery-default" />
      <DateRangePicker
        label="With Range"
        startValue={JUNE_1_2025}
        endValue={JUNE_30_2025}
        id="gallery-range"
      />
      <DateRangePicker label="Required" required id="gallery-required" />
      <DateRangePicker
        label="With Helper"
        helperText="Select the regenerative work period"
        id="gallery-helper"
      />
      <DateRangePicker
        label="With Error"
        error="End date must be after start date"
        id="gallery-error"
      />
      <DateRangePicker
        label="Disabled"
        startValue={JUNE_1_2025}
        endValue={JUNE_30_2025}
        disabled
        id="gallery-disabled"
      />
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    label: "Select Work Period",
    id: "range-interactive",
  },
  render: function Render(args) {
    const [start, setStart] = useState<number | null>(null);
    const [end, setEnd] = useState<number | null>(null);
    return (
      <DateRangePicker
        {...args}
        startValue={start}
        endValue={end}
        onRangeChange={(s, e) => {
          setStart(s);
          setEnd(e);
        }}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the trigger button is rendered
    const trigger = canvas.getByRole("button");
    await expect(trigger).toBeInTheDocument();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Open the date range picker popover
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // The calendar renders in a portal — verify it appeared
    const portal = within(document.body);
    const dayButtons = portal.getAllByRole("gridcell");
    await expect(dayButtons.length).toBeGreaterThan(0);
  },
};
