import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { GardenAlertsCard } from "./GardenAlertsCard";

const meta = {
  title: "Admin/Workflows/Garden/GardenAlertsCard",
  component: GardenAlertsCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Attention Needed on Garden Health. It sits in the tab's rail, except on phones, where it leads above the main column (DL-051).",
      },
    },
  },
  args: {
    alerts: [
      {
        key: "pending-work",
        severity: "critical",
        label: "6 work submissions are waiting for review.",
        onAction: fn(),
      },
      {
        key: "no-assessment",
        severity: "warn",
        label: "No assessment in the last 30 days.",
        onAction: fn(),
      },
    ],
  },
} satisfies Meta<typeof GardenAlertsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAlerts: Story = {};

export const NoAlerts: Story = { args: { alerts: [] } };
