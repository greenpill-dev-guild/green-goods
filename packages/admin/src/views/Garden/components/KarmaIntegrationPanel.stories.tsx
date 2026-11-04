import type {
  KarmaIntegrationController,
  KarmaIntegrationStatusName,
} from "@green-goods/shared/hooks/garden/useKarmaIntegration";
import type { Meta, StoryObj } from "@storybook/react";
import { KarmaIntegrationPanel } from "./KarmaIntegrationPanel";

const PROFILE_URL = "https://www.karmahq.org/project/aiyeloja-family-garden";

function createIntegration(
  status: KarmaIntegrationStatusName,
  overrides: Partial<KarmaIntegrationController> = {}
): KarmaIntegrationController {
  const profileUrl = status === "no-project" || status === "unsupported" ? null : PROFILE_URL;

  return {
    status: {
      status,
      chainId: status === "unsupported" ? 11155111 : 42161,
      gardenAddress: "0x0000000000000000000000000000000000000001",
      projectUID: status === "no-project" ? null : "0x01",
      profileUrl,
      syncVersion: status === "upgrade-needed" ? null : 1,
      requiredSyncVersion: 1,
      reason: status === "failed" ? "admin_sync_failed" : null,
    } as KarmaIntegrationController["status"],
    profileUrl,
    canReconcile: !["unsupported", "upgrade-needed", "synced", "retrying"].includes(status),
    isLoading: false,
    isFetching: false,
    isReconciling: status === "retrying",
    isPending: status === "retrying",
    error: status === "failed" ? new Error("Project admin sync failed") : null,
    reconcile: async () => undefined,
    signatures: 1,
    progress: null,
    hold: null,
    isSettlingHold: false,
    checkHoldAgain: async () => undefined,
    moveOnFromHold: async () => undefined,
    ...overrides,
  };
}

const meta: Meta<typeof KarmaIntegrationPanel> = {
  title: "Admin/Workflows/Garden/KarmaIntegrationPanel",
  component: KarmaIntegrationPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Shows Karma profile health and the available recovery action for a Garden. Stories cover every derived integration state without wallet or indexer dependencies.",
      },
    },
  },
  args: {
    integration: createIntegration("synced"),
  },
};

export default meta;
type Story = StoryObj<typeof KarmaIntegrationPanel>;

export const Synced: Story = {};

export const MigrationNeeded: Story = {
  args: { integration: createIntegration("upgrade-needed") },
};

export const NoProfile: Story = {
  args: { integration: createIntegration("no-project") },
};

export const DetailsPending: Story = {
  args: { integration: createIntegration("stale-details") },
};

export const AccessPending: Story = {
  args: { integration: createIntegration("access-pending") },
};

export const Failed: Story = {
  args: { integration: createIntegration("failed") },
};

export const Retrying: Story = {
  args: { integration: createIntegration("retrying") },
};

/** A garden with many accounts on a rail that signs each call: the count comes before the press. */
export const RetryTakesSeveralSignatures: Story = {
  args: { integration: createIntegration("access-pending", { signatures: 4 }) },
};

/** The second of three signatures is out. */
export const SyncingSecondSignature: Story = {
  args: {
    integration: createIntegration("retrying", { progress: { signature: 2, signatures: 3 } }),
  },
};

/** An earlier sync nobody can confirm pauses the next one until it is checked or moved on from. */
export const HeldSync: Story = {
  args: {
    integration: createIntegration("access-pending", {
      hold: { operationIds: ["held-sync"], calls: 3 },
    }),
  },
};

export const Unsupported: Story = {
  args: { integration: createIntegration("unsupported") },
};

export const Loading: Story = {
  args: {
    integration: createIntegration("synced", {
      isLoading: true,
      profileUrl: null,
    }),
  },
};
