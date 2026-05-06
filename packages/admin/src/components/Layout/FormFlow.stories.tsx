import { Button } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FormFlow, type FormFlowSection } from "./FormFlow";

const sections: FormFlowSection[] = [
  {
    id: "details",
    title: "Details",
    description: "Core title, timing, and routing fields.",
    content: (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-10 rounded-[var(--radius-lg)] bg-bg-weak" />
        <div className="h-10 rounded-[var(--radius-lg)] bg-bg-weak" />
        <div className="h-24 rounded-[var(--radius-lg)] bg-bg-weak sm:col-span-2" />
      </div>
    ),
  },
  {
    id: "requirements",
    title: "Requirements",
    description: "Submission rules, review fields, and media guidance.",
    content: <div className="h-36 rounded-[var(--radius-lg)] bg-bg-weak" />,
  },
  {
    id: "review",
    title: "Review",
    description: "Final confirmation before the local submit action.",
    content: <div className="h-28 rounded-[var(--radius-lg)] bg-bg-weak" />,
  },
];

function actions(disabled = false) {
  return (
    <>
      <Button type="button" variant="secondary" onClick={fn()} disabled={disabled}>
        Cancel
      </Button>
      <Button type="button" onClick={fn()} disabled={disabled} loading={disabled}>
        Save
      </Button>
    </>
  );
}

const meta = {
  title: "Admin/Layout/FormFlow",
  component: FormFlow,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Admin non-wizard form layout for create/edit flows. Actions stay inside the local form surface instead of rendering a fixed body-level footer.",
      },
    },
  },
  args: {
    sections,
    actions: actions(),
  },
} satisfies Meta<typeof FormFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {};

export const Sheet: Story = {
  args: {
    layout: "sheet",
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl bg-bg-white p-4">
        <Story />
      </div>
    ),
  ],
};

export const WithFeedback: Story = {
  args: {
    feedback: (
      <div className="rounded-[var(--radius-lg)] border border-warning-light bg-warning-lighter px-3 py-2 text-sm text-warning-dark">
        Check the highlighted fields before submitting.
      </div>
    ),
  },
};

export const Submitting: Story = {
  args: {
    actions: actions(true),
  },
};
