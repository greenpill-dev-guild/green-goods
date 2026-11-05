import { useHasRole } from "@green-goods/shared/hooks/roles/useHasRole";
import type { Garden } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { fn, mocked } from "storybook/test";
import {
  DEV_MOCK_AUTH_ADDRESSES,
  withAdminIdentityRole,
} from "../../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { LeaveGardenAction } from "./LeaveGardenAction";

const account = DEV_MOCK_AUTH_ADDRESSES.user;
const garden = {
  id: "0x1111111111111111111111111111111111111111",
  name: "Test Community Garden",
  gardeners: [account],
  stewards: [],
  owners: [],
  evaluators: [],
  funders: [],
  communities: [],
} as unknown as Garden;
const meta = {
  title: "Client/Profile/LeaveGardenAction",
  component: LeaveGardenAction,
  tags: ["autodocs"],
  decorators: [withAdminIdentityRole("user")],
  args: { garden, open: true, onClose: fn(), onConfirmed: fn() },
} satisfies Meta<typeof LeaveGardenAction>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Owner: Story = {
  args: { garden: { ...garden, owners: [account] } },
  beforeEach: () => {
    mocked(useHasRole).mockReturnValue({
      hasRole: true,
      isLoading: false,
      error: null,
      refetch: async () => undefined,
    });
    return resetHookMocks(useHasRole);
  },
};
export const Visitor: Story = { args: { garden: { ...garden, gardeners: [] } } };
