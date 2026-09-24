import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { buildRolesByAddress, type StagedMember } from "./addMembersEntry";
import { StagedMemberList } from "./StagedMemberList";

// Fictional people. Rosa gardens here; Kofi stewards, evaluates and gardens;
// the rest are new to the garden.
const ROSA = "0x18c4a9f3b2d1e0f9a8b7c6d5e4f3a2b1c0d9ea67" as Address;
const KOFI = "0xa5e1f0c2b3d4e5f60718293a4b5c6d7e8f901ee0" as Address;
const NEW_A = "0xc2d4e6f8a0b1c3d5e7f9a1b2c3d4e5f6a7b8f0c1" as Address;
const NEW_B = "0x7f3e2d1c0b9a8f7e6d5c4b3a29181716151413f2" as Address;
const NEW_PEOPLE: Address[] = [
  NEW_A,
  NEW_B,
  "0x3b5d7f9a1c3e5f7a9b1d3f5a7c9e1b3d5f7a9c31",
  "0x9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2918f7",
];

const rolesByAddress = buildRolesByAddress({
  owner: [],
  steward: [KOFI],
  evaluator: [KOFI],
  gardener: [KOFI, ROSA],
  funder: [],
  community: [],
} satisfies Record<GardenRole, Address[]>);

const newGardeners: StagedMember[] = [
  { address: NEW_A, role: "gardener" },
  { address: NEW_B, role: "gardener" },
];

const withPromotions: StagedMember[] = [
  { address: NEW_A, role: "gardener" },
  { address: ROSA, role: "steward" },
  { address: KOFI, role: "owner" },
];

const meta: Meta<typeof StagedMemberList> = {
  title: "Admin/Workflows/Garden/StagedMemberList",
  component: StagedMemberList,
  tags: ["autodocs"],
  decorators: [
    withSeededQueryClient([
      [queryKeys.ens.name(ROSA.toLowerCase()), "rosa.eth"],
      [queryKeys.ens.name(KOFI.toLowerCase()), "kofi.eth"],
      ...NEW_PEOPLE.map((address) => [queryKeys.ens.name(address.toLowerCase()), null] as const),
    ]),
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "The Add Members queue: who is being added and the role each person is getting. People already in the garden also show the roles they hold today, so a promotion reads at a glance; new people stay one line. The list keeps a fixed height and scrolls inside.",
      },
    },
  },
  args: {
    members: [],
    rolesByAddress,
    onRemove: fn(),
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof StagedMemberList>;

export const Empty: Story = {};

export const NewPeople: Story = {
  args: { members: newGardeners },
};

/** Rosa is promoted to Steward; Kofi, who holds three roles, becomes an Owner. */
export const WithPromotions: Story = {
  args: { members: withPromotions },
};

export const WriteInFlight: Story = {
  args: { members: withPromotions, disabled: true },
};

/** More rows than the reserved height: the list scrolls, the dialog never grows. */
export const Overflow: Story = {
  args: {
    members: [
      ...NEW_PEOPLE.map((address): StagedMember => ({ address, role: "gardener" })),
      { address: ROSA, role: "steward" },
      { address: KOFI, role: "owner" },
    ],
  },
};
