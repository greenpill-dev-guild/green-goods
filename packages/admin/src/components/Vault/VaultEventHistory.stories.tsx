import {
  type Address,
  DEFAULT_CHAIN_ID,
  queryKeys,
  type VaultEvent,
  type VaultEventType,
} from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { daysAgo } from "../../../../shared/.storybook/fixtures";
import { withAdminIdentity, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { VaultEventHistory } from "./VaultEventHistory";

const GARDEN_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678" as Address;
const ASSET = "0x4200000000000000000000000000000000000006" as Address;
const VAULT = "0x00000000000000000000000000000000000aaaa1" as Address;
const ACTOR_A = "0x1111111111111111111111111111111111111111" as Address;
const ACTOR_B = "0x2222222222222222222222222222222222222222" as Address;

// Must match the `limit` that `VaultEventHistory` passes to
// `useVaultEvents` — the seeded key tuple includes `limit`, so any
// drift silently falls through to the real (mock-transport) query.
const VAULT_EVENTS_STORY_LIMIT = 200;
const eventsKey = queryKeys.vaults.events(
  GARDEN_ADDRESS.toLowerCase(),
  DEFAULT_CHAIN_ID,
  VAULT_EVENTS_STORY_LIMIT
);

function makeEvent(
  id: string,
  eventType: VaultEventType,
  amount: bigint | null,
  daysAgoCount: number,
  actor: Address = ACTOR_A
): VaultEvent {
  return {
    id,
    chainId: DEFAULT_CHAIN_ID,
    garden: GARDEN_ADDRESS,
    asset: ASSET,
    vaultAddress: VAULT,
    eventType,
    actor,
    amount,
    shares: amount,
    txHash: `0x${id.padStart(64, "0")}` as `0x${string}`,
    timestamp: daysAgo(daysAgoCount),
  };
}

const EVENTS: VaultEvent[] = [
  makeEvent("1", "DEPOSIT", 5_000_000_000_000_000_000n, 1, ACTOR_A),
  makeEvent("2", "HARVEST", 250_000_000_000_000_000n, 3),
  makeEvent("3", "DEPOSIT", 2_500_000_000_000_000_000n, 5, ACTOR_B),
  makeEvent("4", "WITHDRAW", 800_000_000_000_000_000n, 8, ACTOR_B),
  makeEvent("5", "EMERGENCY_PAUSED", null, 14),
];

const meta: Meta<typeof VaultEventHistory> = {
  title: "Admin/Workflows/Vault/VaultEventHistory",
  component: VaultEventHistory,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Real `VaultEventHistory`. Seeds `useVaultEvents` with fixture events; the desktop table and mobile card layout are both rendered by the live component.",
      },
    },
  },
  args: {
    gardenAddress: GARDEN_ADDRESS,
  },
};

export default meta;
type Story = StoryObj<typeof VaultEventHistory>;

export const WithEvents: Story = {
  decorators: [withAdminIdentity, withSeededQueryClient([[eventsKey, EVENTS]])],
};

export const Empty: Story = {
  decorators: [withAdminIdentity, withSeededQueryClient([[eventsKey, []]])],
};

export const LongList: Story = {
  decorators: [
    withAdminIdentity,
    withSeededQueryClient([
      [
        eventsKey,
        Array.from({ length: 35 }, (_, i) =>
          makeEvent(
            String(i + 1),
            i % 3 === 0 ? "DEPOSIT" : i % 3 === 1 ? "HARVEST" : "WITHDRAW",
            1_000_000_000_000_000_000n * BigInt((i % 9) + 1),
            i
          )
        ),
      ],
    ]),
  ],
};
