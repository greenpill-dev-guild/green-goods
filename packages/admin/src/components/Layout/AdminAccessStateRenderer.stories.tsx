import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withCanvasFrame, withRouter } from "../../../../shared/.storybook/decorators";
import { AdminAccessStateRenderer } from "./AdminAccessStateRenderer";

const meta: Meta<typeof AdminAccessStateRenderer> = {
  title: "Admin/Shell/AdminAccessStateRenderer",
  component: AdminAccessStateRenderer,
  tags: ["autodocs"],
  decorators: [
    withRouter(["/hub/work"]),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[640px]",
      workspace: "home",
    }),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Admin access-state renderer shared by the '/' entrypoint and direct canvas route bookmarks.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminAccessStateRenderer>;

export const Checking: Story = {
  args: {
    state: { status: "checking" },
    ready: <div>Ready canvas</div>,
  },
};

export const ConnectRequired: Story = {
  args: {
    state: { status: "disconnected" },
    ready: <div>Ready canvas</div>,
  },
};

export const WalletRequired: Story = {
  args: {
    state: { status: "embedded-wallet", signOut: fn() },
    ready: <div>Ready canvas</div>,
  },
};

export const NoAccess: Story = {
  args: {
    state: { status: "no-access", canCreateGarden: false },
    ready: <div>Ready canvas</div>,
  },
};

export const IndexerError: Story = {
  args: {
    state: { status: "indexer-error" },
    ready: <div>Ready canvas</div>,
  },
};

export const Ready: Story = {
  args: {
    state: {
      status: "ready",
      eligibleGardens: [],
      resolvedDefaultGarden: null,
      hasStaleBaseList: false,
    },
    ready: (
      <div className="flex min-h-full items-center justify-center px-6 text-sm font-medium text-text-strong">
        Ready canvas
      </div>
    ),
  },
};
