import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Form/Select";

const meta: Meta<typeof Button> = {
  title: "Shared/Primitives/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "danger"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
    loading: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: "Create garden",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Filter",
  },
};

export const Danger: Story = {
  args: {
    variant: "danger",
    children: "Remove member",
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: "Saving changes",
  },
};

export const AsLink: Story = {
  render: () => (
    <Button asChild>
      <a href="/">Open dashboard</a>
    </Button>
  ),
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};

export const ControlPairing: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Select defaultValue="system">
        <SelectTrigger size="sm" className="w-36">
          <SelectValue placeholder="System" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
          <SelectItem value="system">System</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="secondary" size="sm">
        Refresh
      </Button>
    </div>
  ),
};
