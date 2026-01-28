import type { Meta, StoryObj } from "@storybook/react";
import { FormTextarea } from "./FormTextarea";

const meta: Meta<typeof FormTextarea> = {
  title: "Components/Form/FormTextarea",
  component: FormTextarea,
  tags: ["autodocs"],
  argTypes: {
    label: {
      control: "text",
      description: "Textarea label",
    },
    placeholder: {
      control: "text",
      description: "Placeholder text",
    },
    helperText: {
      control: "text",
      description: "Helper text below textarea",
    },
    error: {
      control: "text",
      description: "Error message",
    },
    rows: {
      control: "number",
      description: "Number of visible text lines",
    },
    disabled: {
      control: "boolean",
      description: "Disabled state",
    },
  },
};

export default meta;
type Story = StoryObj<typeof FormTextarea>;

export const Default: Story = {
  args: {
    label: "Description",
    placeholder: "Enter a description",
    id: "description-textarea",
    rows: 4,
  },
};

export const WithHelperText: Story = {
  args: {
    label: "Notes",
    placeholder: "Add any additional notes",
    helperText: "Maximum 500 characters",
    id: "notes-textarea",
    rows: 4,
  },
};

export const WithError: Story = {
  args: {
    label: "Description",
    placeholder: "Enter a description",
    error: "Description is required",
    id: "error-textarea",
    rows: 4,
  },
};

export const Disabled: Story = {
  args: {
    label: "Description",
    placeholder: "Enter a description",
    disabled: true,
    defaultValue: "This content cannot be edited",
    id: "disabled-textarea",
    rows: 4,
  },
};

export const LargeRows: Story = {
  args: {
    label: "Long Form Content",
    placeholder: "Write your content here...",
    id: "large-textarea",
    rows: 8,
  },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-md">
      <FormTextarea label="Default" placeholder="Enter text" id="state-default" />
      <FormTextarea
        label="With Helper"
        placeholder="Enter text"
        helperText="This is helper text"
        id="state-helper"
      />
      <FormTextarea
        label="With Error"
        placeholder="Enter text"
        error="This field is required"
        id="state-error"
      />
      <FormTextarea
        label="Disabled"
        placeholder="Enter text"
        disabled
        defaultValue="Cannot edit"
        id="state-disabled"
      />
    </div>
  ),
};
