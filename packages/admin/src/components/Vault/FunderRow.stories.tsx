import { useResolvedProfileAvatar } from "@green-goods/shared/hooks/profile/useProfileAvatar";
import type { Address } from "@green-goods/shared/types/domain";
import type { FunderLeaderboardEntry } from "@green-goods/shared/types/vaults";
import type { Meta, StoryObj } from "@storybook/react";
import { mocked } from "storybook/test";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import { FunderRow } from "./FunderRow";

function makeFunder(
  addr: Address,
  yieldGenerated: bigint,
  gardenCount = 2
): FunderLeaderboardEntry {
  return {
    address: addr,
    totalYieldGenerated: yieldGenerated,
    gardenCount,
  } as unknown as FunderLeaderboardEntry;
}

const HIGH = makeFunder(
  "0x1111111111111111111111111111111111111111" as Address,
  10_000_000_000_000_000_000n,
  4
);
const MID = makeFunder(
  "0x2222222222222222222222222222222222222222" as Address,
  3_500_000_000_000_000_000n,
  2
);
const LOW = makeFunder(
  "0x3333333333333333333333333333333333333333" as Address,
  500_000_000_000_000_000n,
  1
);
const ZERO = makeFunder("0x4444444444444444444444444444444444444444" as Address, 0n, 1);

const meta: Meta<typeof FunderRow> = {
  title: "Admin/Workflows/Vault/FunderRow",
  component: FunderRow,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "One funder in the ranked supporter view: a person row with the Funder chip and, as its one count, the yield the funder's deposits have generated. The name comes from the shared address display; these funders have published none, so each shows its short address and the avatar its glyph.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-md p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    mocked(useResolvedProfileAvatar).mockReturnValue({
      avatarUri: null,
      isLoading: false,
    } as ReturnType<typeof useResolvedProfileAvatar>);
    return resetHookMocks(useResolvedProfileAvatar);
  },
};

export default meta;
type Story = StoryObj<typeof FunderRow>;

export const TopFunder: Story = {
  args: { funder: HIGH },
};

export const MidFunder: Story = {
  args: { funder: MID },
};

export const LowFunder: Story = {
  args: { funder: LOW },
};

export const NoYield: Story = {
  args: { funder: ZERO },
};
