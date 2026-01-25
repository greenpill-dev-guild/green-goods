import type { Meta, StoryObj } from "@storybook/react";
import { FormInput } from "./FormInput";

const meta: Meta<typeof FormInput> = {
  title: "Components/Form/FormInput",
  component: FormInput,
  tags: ["autodocs"],
  argTypes: {
    label: {
      control: "text",
      description: "Input label",
    },
    placeholder: {
      control: "text",
      description: "Placeholder text",
    },
    helperText: {
      control: "text",
      description: "Helper text below input",
    },
    error: {
      control: "text",
      description: "Error message",
    },
    disabled: {
      control: "boolean",
      description: "Disabled state",
    },
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "tel"],
      description: "Input type",
    },
  },
};

export default meta;
type Story = StoryObj<typeof FormInput>;

export const Default: Story = {
  args: {
    label: "Email",
    placeholder: "Enter your email",
    id: "email-input",
  },
};

export const WithHelperText: Story = {
  args: {
    label: "Username",
    placeholder: "Choose a username",
    helperText: "Must be at least 3 characters",
    id: "username-input",
  },
};

export const WithError: Story = {
  args: {
    label: "Email",
    placeholder: "Enter your email",
    error: "Please enter a valid email address",
    id: "email-error-input",
    defaultValue: "invalid-email",
  },
};

export const Disabled: Story = {
  args: {
    label: "Email",
    placeholder: "Enter your email",
    disabled: true,
    id: "disabled-input",
    defaultValue: "user@example.com",
  },
};

export const Password: Story = {
  args: {
    label: "Password",
    placeholder: "Enter your password",
    type: "password",
    id: "password-input",
  },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-md">
      <FormInput
        label="Default"
        placeholder="Enter text"
        id="state-default"
      />
      <FormInput
        label="With Helper"
        placeholder="Enter text"
        helperText="This is helper text"
        id="state-helper"
      />
      <FormInput
        label="With Error"
        placeholder="Enter text"
        error="This field is required"
        id="state-error"
      />
      <FormInput
        label="Disabled"
        placeholder="Enter text"
        disabled
        defaultValue="Cannot edit"
        id="state-disabled"
      />
    </div>
  ),
};
