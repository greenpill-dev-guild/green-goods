import type { Meta, StoryObj } from "@storybook/react";
import ceremony from "./CeremonyView.stories";
import { PermissionsView } from "./PermissionsView";

const ACCOUNT = "0x1f3a9c2b7d4e5f60718293a4b5c6d7e8f9012345";
const noop = () => {};
const asyncNoop = async () => {};

type Props = Parameters<typeof PermissionsView>[0];
const found: Props["permissions"] = [
  {
    permissionId: `0x${"12".repeat(4)}`,
    signerAddress: ACCOUNT,
    active: true,
    nonce: 0,
    descriptor: null,
  },
];

const meta: Meta<typeof PermissionsView> = {
  title: "Client/Public/AgentReporting/Permissions",
  component: PermissionsView,
  // The focused shell and the language switch, as the ceremony stories set them up.
  decorators: ceremony.decorators as Meta<typeof PermissionsView>["decorators"],
  parameters: {
    ...ceremony.parameters,
    docs: {
      description: {
        component:
          "`/agent/reporting/permissions` — checking and removing an account's permissions " +
          "directly with its owner. The status card is on the page from the start, so a check " +
          "that begins, finds something or fails moves nothing under it. The bar holds the one " +
          "act that is always there; removing sits under the list it acts on.",
      },
    },
  },
  args: {
    account: null,
    connecting: false,
    connectWallet: noop,
    connectPasskey: asyncNoop,
    stage: "idle",
    permissions: [],
    descriptors: [],
    error: null,
    scan: asyncNoop,
    importDescriptor: () => false,
    exportDescriptors: () => "[]",
    revoke: asyncNoop,
  },
};
export default meta;

type Story = StoryObj<typeof PermissionsView>;

export const NotConnected: Story = {};
export const Connected: Story = { args: { account: ACCOUNT } };
export const Checking: Story = { args: { account: ACCOUNT, stage: "inspecting" } };
export const Active: Story = { args: { account: ACCOUNT, stage: "ready", permissions: found } };
export const Empty: Story = { args: { account: ACCOUNT, stage: "ready" } };
export const Removing: Story = { args: { ...Active.args, stage: "revoking" } };
/** The network hasn't confirmed the removal, so the card asks for another check, not another send. */
export const Submitted: Story = {
  args: { ...Active.args, stage: "submitted", error: "outcome_unknown" },
};
export const Removed: Story = {
  args: {
    ...Active.args,
    stage: "revoked",
    permissions: found.map((permission) => ({ ...permission, active: false })),
  },
};
export const Unsupported: Story = {
  args: { account: ACCOUNT, stage: "failed", error: "unsupported_account" },
};
export const Declined: Story = { args: { ...Active.args, error: "declined" } };
