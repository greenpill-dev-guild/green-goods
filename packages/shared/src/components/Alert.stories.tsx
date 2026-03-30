import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { Button } from "./Button";
import { Alert } from "./Alert";

const meta: Meta<typeof Alert> = {
  title: "Feedback/Alert",
  component: Alert,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["error", "warning", "info", "success"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Info: Story = {
  args: {
    variant: "info",
    title: "Indexer sync delayed",
    children: "Recent blocks are still processing. Data may lag for a few minutes.",
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
    title: "Open minting disabled",
    children: "Create garden remains hidden until deployment registry permissions are available.",
  },
};

export const Error: Story = {
  args: {
    variant: "error",
    title: "Indexer unavailable",
    children: "Failed to load the latest garden data. Retry after connectivity is restored.",
  },
};

export const Success: Story = {
  args: {
    variant: "success",
    title: "Deployment completed",
    children: "Contracts were published and the registry has been updated.",
  },
};

export const Dismissible: Story = {
  args: {
    variant: "warning",
    title: "Review recommended",
    children: "This workspace still has pending submissions.",
    onDismiss: fn(),
  },
};

export const WithAction: Story = {
  args: {
    variant: "info",
    title: "Treasury data refreshed",
    children: "Re-run the reconciliation flow if the balances still look stale.",
    action: <Button size="sm" variant="secondary">Refresh</Button>,
  },
};
