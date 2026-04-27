import { type Address, type HypercertRecord } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { withAdminIdentity, withRouter } from "../../../../shared/.storybook/decorators";
import { GardenHypercertsPanel } from "./GardenHypercertsPanel";

const GARDEN_ADDRESS = "0x1234567890AbcdEF1234567890aBcdef12345678" as Address;

function record(i: number, title: string | null): HypercertRecord {
  return {
    id: `0x${i.toString().padStart(64, "0")}`,
    tokenId: BigInt(i),
    gardenId: GARDEN_ADDRESS,
    // IPFS CIDv1 prefix (bafy…) avoids "gateway unknown" fallbacks in
    // shared `resolveIPFSUrl` when no IPFS gateway is configured.
    metadataUri: `ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzd${i}`,
    mintedAt: 1_700_000_000 + i * 86_400,
    mintedBy: GARDEN_ADDRESS,
    txHash: `0x${i.toString().padStart(64, "0")}`,
    totalUnits: 1_000_000n,
    claimedUnits: 0n,
    attestationCount: 3 + i,
    title,
  };
}

const HYPERCERTS: HypercertRecord[] = [
  record(1, "Atlantic Forest planting — Q1"),
  record(2, "Community workshop cohort"),
  record(3, null),
];

const meta: Meta<typeof GardenHypercertsPanel> = {
  title: "Admin/Workflows/Garden/GardenHypercertsPanel",
  component: GardenHypercertsPanel,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withRouter(["/garden"])],
  parameters: {
    docs: {
      description: {
        component:
          "List of hypercerts minted by a garden with links to the detail route and the public hypercerts app. When `canManage` is true, the embedded ActiveListingsTable renders (its own loading/error states come from wagmi hooks).",
      },
    },
  },
  args: {
    gardenId: GARDEN_ADDRESS,
    gardenAddress: GARDEN_ADDRESS,
  },
};

export default meta;
type Story = StoryObj<typeof GardenHypercertsPanel>;

export const WithHypercerts: Story = {
  args: {
    hypercerts: HYPERCERTS,
    isLoading: false,
    canManage: false,
  },
};

export const Loading: Story = {
  args: {
    hypercerts: [],
    isLoading: true,
    canManage: false,
  },
};

export const Empty: Story = {
  args: {
    hypercerts: [],
    isLoading: false,
    canManage: false,
  },
};

export const WithManageAccess: Story = {
  args: {
    hypercerts: HYPERCERTS,
    isLoading: false,
    canManage: true,
  },
};
