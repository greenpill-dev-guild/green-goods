import type { Meta, StoryObj } from "@storybook/react";
import { BootRecovery, BootShell } from "./BootSurface";

const noop = () => undefined;

const meta: Meta<typeof BootRecovery> = {
  title: "Admin/Boot/BootSurface",
  component: BootRecovery,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The two frames the admin can show before any provider exists: the boot shell that mounts synchronously on startup, and the recovery card a startup failure renders in place of an empty root.",
      },
    },
  },
  args: { onReload: noop, onReset: noop },
};

export default meta;
type Story = StoryObj<typeof BootRecovery>;

export const Loading: Story = {
  render: () => <BootShell />,
};

export const StartupFailed: Story = {
  args: {
    error: new DOMException(
      "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
      "SecurityError"
    ),
  },
};

export const ChunkFailed: Story = {
  args: {
    error: new TypeError("Failed to fetch dynamically imported module: /assets/AdminRoot.js"),
  },
};
