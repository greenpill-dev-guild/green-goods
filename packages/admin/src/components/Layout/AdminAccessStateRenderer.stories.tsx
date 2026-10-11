import type { Meta, StoryObj } from "@storybook/react";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { fn } from "storybook/test";
import {
  withAdminIdentityRole,
  withCanvasFrame,
  withRouter,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import { AdminAccessStateRenderer } from "./AdminAccessStateRenderer";

const accountAddress = "0x1234567890123456789012345678901234567890" as const;
const noAccessDecorators = [
  withAdminIdentityRole("user"),
  withSeededQueryClient([
    [queryKeys.gardens.byChain(DEFAULT_CHAIN_ID), []],
    [queryKeys.role.stewardGardens(accountAddress, DEFAULT_CHAIN_ID), []],
    [
      queryKeys.role.deploymentPermissions(accountAddress, DEFAULT_CHAIN_ID),
      { isOwner: false, isInAllowlist: false, canDeploy: false },
    ],
    [queryKeys.ens.name(accountAddress), null],
    [queryKeys.ens.avatar(accountAddress), null],
    [queryKeys.ens.protocolName(accountAddress), null],
    [queryKeys.profileAvatars.record(DEFAULT_CHAIN_ID, accountAddress), null],
  ]),
];

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
  decorators: noAccessDecorators,
  args: {
    state: { status: "no-access", canCreateGarden: false },
    ready: <div>Ready canvas</div>,
  },
};

export const IndexerError: Story = {
  decorators: noAccessDecorators,
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
      <div className="flex min-h-full items-center justify-center px-6 body-sm font-medium text-text-strong">
        Ready canvas
      </div>
    ),
  },
};
