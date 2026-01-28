import type { Meta, StoryObj } from "@storybook/react";
import { CenteredSpinner, Spinner } from "./Spinner";

const meta: Meta<typeof Spinner> = {
  title: "Components/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Size of the spinner",
    },
    label: {
      control: "text",
      description: "Screen reader label",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {
  args: {
    size: "md",
    label: "Loading",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    label: "Loading",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    label: "Loading",
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
    </div>
  ),
};

// CenteredSpinner stories
export const Centered: StoryObj<typeof CenteredSpinner> = {
  render: () => <CenteredSpinner message="Loading your data..." />,
};

export const CenteredFullScreen: StoryObj<typeof CenteredSpinner> = {
  render: () => <CenteredSpinner fullScreen message="Loading application..." />,
  parameters: {
    layout: "fullscreen",
  },
};
