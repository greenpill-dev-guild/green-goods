import type { Meta, StoryObj } from "@storybook/react";
import { FormLayout } from "./FormLayout";
import { FormInput } from "./FormInput";
import { FormTextarea } from "./FormTextarea";

const meta: Meta<typeof FormLayout> = {
  title: "Components/Form/FormLayout",
  component: FormLayout,
  tags: ["autodocs"],
  argTypes: {
    maxWidth: {
      control: "select",
      options: ["sm", "md", "lg", "xl", "2xl", "4xl"],
      description: "Maximum width of the form container",
    },
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof FormLayout>;

export const Default: Story = {
  args: {
    maxWidth: "lg",
    children: (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Contact Form</h2>
        <FormInput label="Name" placeholder="Enter your name" id="name" />
        <FormInput label="Email" placeholder="Enter your email" type="email" id="email" />
        <FormTextarea label="Message" placeholder="Enter your message" id="message" />
        <button className="px-4 py-2 bg-primary text-white rounded-lg w-fit">Submit</button>
      </div>
    ),
  },
};

export const Small: Story = {
  args: {
    maxWidth: "sm",
    children: (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Login</h2>
        <FormInput label="Email" placeholder="Enter your email" type="email" id="login-email" />
        <FormInput
          label="Password"
          placeholder="Enter your password"
          type="password"
          id="login-password"
        />
        <button className="px-4 py-2 bg-primary text-white rounded-lg w-full">Sign In</button>
      </div>
    ),
  },
};

export const Medium: Story = {
  args: {
    maxWidth: "md",
    children: (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Profile Settings</h2>
        <FormInput label="Display Name" placeholder="Your display name" id="display-name" />
        <FormTextarea label="Bio" placeholder="Tell us about yourself" id="bio" rows={3} />
      </div>
    ),
  },
};

export const ExtraLarge: Story = {
  args: {
    maxWidth: "2xl",
    children: (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Work Submission</h2>
        <div className="grid grid-cols-2 gap-4">
          <FormInput label="Title" placeholder="Work title" id="title" />
          <FormInput label="Location" placeholder="Garden location" id="location" />
        </div>
        <FormTextarea
          label="Description"
          placeholder="Describe the work completed"
          id="description"
          rows={4}
        />
      </div>
    ),
  },
};

export const AllWidths: Story = {
  render: () => (
    <div className="flex flex-col gap-8 bg-bg-weak-50 min-h-screen py-8">
      <FormLayout maxWidth="sm">
        <div className="bg-bg-white-0 p-4 rounded-lg border">
          <p className="text-sm font-medium">max-w-sm (384px)</p>
        </div>
      </FormLayout>
      <FormLayout maxWidth="md">
        <div className="bg-bg-white-0 p-4 rounded-lg border">
          <p className="text-sm font-medium">max-w-md (448px)</p>
        </div>
      </FormLayout>
      <FormLayout maxWidth="lg">
        <div className="bg-bg-white-0 p-4 rounded-lg border">
          <p className="text-sm font-medium">max-w-lg (512px)</p>
        </div>
      </FormLayout>
      <FormLayout maxWidth="xl">
        <div className="bg-bg-white-0 p-4 rounded-lg border">
          <p className="text-sm font-medium">max-w-xl (576px)</p>
        </div>
      </FormLayout>
      <FormLayout maxWidth="2xl">
        <div className="bg-bg-white-0 p-4 rounded-lg border">
          <p className="text-sm font-medium">max-w-2xl (672px)</p>
        </div>
      </FormLayout>
    </div>
  ),
  parameters: {
    layout: "fullscreen",
  },
};
