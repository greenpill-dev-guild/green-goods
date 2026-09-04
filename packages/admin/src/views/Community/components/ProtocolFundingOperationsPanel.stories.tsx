import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { QueryKey } from "@tanstack/react-query";
import type { Meta, StoryObj } from "@storybook/react";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withAdminPrimitiveFrame,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import { STORY_GARDEN, STORY_ROOT_GARDEN, storyPool } from "../../Garden/Pool/poolStoryFixtures";
import { ProtocolFundingOperationsPanel } from "./ProtocolFundingOperationsPanel";

const SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  [
    queryKeys.commitmentPooling.pools(DEFAULT_CHAIN_ID),
    [
      storyPool({
        id: `${DEFAULT_CHAIN_ID}-1`,
        poolId: 1n,
        poolType: "PROTOCOL",
        garden: STORY_ROOT_GARDEN,
        gardenId: STORY_ROOT_GARDEN,
      }),
      storyPool({ garden: STORY_GARDEN, gardenId: STORY_GARDEN }),
    ],
  ],
];

const meta: Meta<typeof ProtocolFundingOperationsPanel> = {
  title: "Admin/Community/ProtocolFundingOperationsPanel",
  component: ProtocolFundingOperationsPanel,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withSeededQueryClient(SEEDS), withAdminPrimitiveFrame],
  args: {
    chainId: DEFAULT_CHAIN_ID,
    protocolGarden: STORY_ROOT_GARDEN,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Integration story for the registered-pool recipient catalogue and protocol funding controller. Without a live wallet, the action state remains read-only.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProtocolFundingOperationsPanel>;

export const RegisteredRecipients: Story = {};
