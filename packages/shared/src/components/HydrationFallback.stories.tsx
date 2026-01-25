import type { Meta, StoryObj } from "@storybook/react";
import { HydrationFallback } from "./HydrationFallback";

const meta: Meta<typeof HydrationFallback> = {
  title: "Components/HydrationFallback",
  component: HydrationFallback,
  tags: ["autodocs"],
  argTypes: {
    appName: {
      control: "text",
      description: "App name for screen reader",
    },
    showIcon: {
      control: "boolean",
      description: "Show icon above spinner",
    },
    message: {
      control: "text",
      description: "Optional loading message",
    },
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof HydrationFallback>;

export const Default: Story = {
  args: {
    appName: "Green Goods",
  },
};

export const WithIcon: Story = {
  args: {
    appName: "Green Goods",
    showIcon: true,
  },
};

export const WithMessage: Story = {
  args: {
    appName: "Green Goods",
    message: "Loading your dashboard...",
  },
};

export const WithIconAndMessage: Story = {
  args: {
    appName: "Green Goods Admin",
    showIcon: true,
    message: "Preparing your workspace...",
  },
};

export const ClientStyle: Story = {
  args: {
    appName: "Green Goods",
    showIcon: false,
  },
};

export const AdminStyle: Story = {
  args: {
    appName: "Green Goods Admin",
    showIcon: true,
    message: "Loading administrative tools...",
  },
};
