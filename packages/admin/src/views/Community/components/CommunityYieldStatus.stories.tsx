import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Meta, StoryObj } from "@storybook/react";
import { withRouter, withSeededQueryClient } from "../../../../../shared/.storybook/decorators";
import { CommunityYieldStatus } from "./CommunityYieldStatus";

const gardenId = "0x1111111111111111111111111111111111111111";
const meta = {
  title: "Admin/Workflows/Community/YieldStatus",
  component: CommunityYieldStatus,
  tags: ["autodocs"],
  decorators: [withRouter(["/community/coordination"])],
  parameters: { layout: "padded" },
  args: { gardenId, enabled: true },
} satisfies Meta<typeof CommunityYieldStatus>;
export default meta;
type Story = StoryObj<typeof meta>;

function wiring(status: "connected" | "missing-resolver-wiring" | "mismatch") {
  return withSeededQueryClient([
    [
      queryKeys.yield.wiring(gardenId, DEFAULT_CHAIN_ID),
      {
        readStatus: "available",
        status,
        gardenAddress: gardenId,
        expectedHypercertPoolAddress: "0x2222222222222222222222222222222222222222",
        repairHref:
          status === "connected" ? undefined : `/community/coordination?gardenId=${gardenId}`,
        issues: [],
      },
    ],
  ]);
}

export const Connected: Story = { decorators: [wiring("connected")] };
export const MissingWiring: Story = { decorators: [wiring("missing-resolver-wiring")] };
export const MismatchedWiring: Story = { decorators: [wiring("mismatch")] };
