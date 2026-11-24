import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { GardenCreators } from "@green-goods/shared/hooks/gardener/useRole";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import { FIXTURE_IMAGE_PROFILE } from "../../../../../shared/.storybook/fixtures";
import { GardenCreatorsCard } from "./GardenCreatorsCard";

const RIOLAB = "0x1111111111111111111111111111111111111111" as Address;
const ANA = "0x2222222222222222222222222222222222222222" as Address;
const UNNAMED = "0x3333333333333333333333333333333333333333" as Address;

interface StoryCreator {
  address: Address;
  protocolName?: string;
  ensName?: string;
  photo?: string;
}

const STORY_CREATORS: StoryCreator[] = [
  { address: RIOLAB, protocolName: "riolab.greengoods.eth", photo: FIXTURE_IMAGE_PROFILE },
  { address: ANA, ensName: "ana-souza.eth" },
  { address: UNNAMED },
];

/** Each creator's names and photo, so the rows never read the network. */
const CREATOR_IDENTITY_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = STORY_CREATORS.flatMap(
  (creator) => [
    [queryKeys.ens.name(creator.address), creator.ensName ?? null] as const,
    [queryKeys.ens.protocolName(creator.address), creator.protocolName ?? null] as const,
    [queryKeys.ens.avatar(creator.address), creator.photo ?? null] as const,
    [queryKeys.ens.passkeyName(DEFAULT_CHAIN_ID, creator.address), null] as const,
    [queryKeys.profileAvatars.record(DEFAULT_CHAIN_ID, creator.address), null] as const,
  ]
);

function storyCreators(overrides: Partial<GardenCreators> = {}): GardenCreators {
  return {
    creators: [RIOLAB, ANA, UNNAMED],
    canManage: true,
    loading: false,
    isWriting: false,
    addCreator: async () => true,
    removeCreator: async () => true,
    ...overrides,
  };
}

const meta: Meta<typeof GardenCreatorsCard> = {
  title: "Admin/Community/GardenCreatorsCard",
  component: GardenCreatorsCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Who may create a garden, on the Community Garden's Community → Coordination tab. The deployment registry decides who sees the card: its owner and the Community Garden's owners and stewards.",
      },
    },
  },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(CREATOR_IDENTITY_SEEDS),
    (Story) => (
      <div className="max-w-3xl p-4" data-tone="community">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof GardenCreatorsCard>;

export const Default: Story = { args: { creators: storyCreators() } };

export const Empty: Story = { args: { creators: storyCreators({ creators: [] }) } };

export const Loading: Story = {
  args: { creators: storyCreators({ creators: [], loading: true }) },
};

export const ReadError: Story = {
  args: { creators: storyCreators({ creators: [], error: "The registry could not be reached" }) },
};

export const Writing: Story = { args: { creators: storyCreators({ isWriting: true }) } };
