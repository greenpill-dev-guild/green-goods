import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useProtocolMemberStatus } from "@green-goods/shared/hooks/ens/useProtocolMemberStatus";
import {
  useClaimFirstSupportBadge,
  useClaimFirstWorkBadge,
  useClaimGenesisBadge,
} from "@green-goods/shared/hooks/greenwill/useClaimGreenWillBadge";
import { useGreenWillBadges } from "@green-goods/shared/hooks/greenwill/useGreenWillBadges";
import { useMyVaultDeposits } from "@green-goods/shared/hooks/vault/useMyVaultDeposits";
import { useMyOnlineWorks } from "@green-goods/shared/hooks/work/useMyWorks";
import type { Address } from "@green-goods/shared/types/domain";
import type { GreenWillBadgeView } from "@green-goods/shared/types/greenwill";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, screen, userEvent, within } from "storybook/test";
import { STORYBOOK_NOW_SECONDS } from "../../../../shared/.storybook/fixtures";
import { ProfileBadges } from "./Badges";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";

const ACCOUNT = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e" as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

function badge(
  slug: "genesis" | "first-work" | "first-support",
  owned: boolean
): GreenWillBadgeView {
  const badgeId =
    `0x${slug === "genesis" ? "01" : slug === "first-work" ? "02" : "03"}` as `0x${string}`;
  return {
    id: `${DEFAULT_CHAIN_ID}-${badgeId}`,
    chainId: DEFAULT_CHAIN_ID,
    badgeId,
    slug,
    metadataURI: "",
    validator: ZERO,
    authorizedIssuer: ZERO,
    unlockLock: ZERO,
    claimable: true,
    active: true,
    holderCount: 18,
    grantCount: 18,
    updatedAt: STORYBOOK_NOW_SECONDS,
    owned,
    claimableNow: !owned,
    ownership: null,
  };
}

function claim(isPending = false) {
  return { mutate: fn(), isPending } as unknown as ReturnType<typeof useClaimGenesisBadge>;
}

function withBadges({ claiming = false } = {}) {
  return () => {
    const badges = [badge("first-work", true), badge("genesis", false)];
    mocked(usePrimaryAddress).mockReturnValue(ACCOUNT);
    mocked(useGreenGoodsEnsName).mockReturnValue({ data: "afo.greengoods.eth" } as ReturnType<
      typeof useGreenGoodsEnsName
    >);
    mocked(useEnsName).mockReturnValue({ data: null } as ReturnType<typeof useEnsName>);
    mocked(useProtocolMemberStatus).mockReturnValue({ data: true, isLoading: false } as ReturnType<
      typeof useProtocolMemberStatus
    >);
    mocked(useMyOnlineWorks).mockReturnValue({ data: [] } as unknown as ReturnType<
      typeof useMyOnlineWorks
    >);
    mocked(useMyVaultDeposits).mockReturnValue({ deposits: [] } as unknown as ReturnType<
      typeof useMyVaultDeposits
    >);
    mocked(useGreenWillBadges).mockReturnValue({
      badges,
      earnedBadges: badges.filter((entry) => entry.owned),
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useGreenWillBadges>);
    mocked(useClaimGenesisBadge).mockReturnValue(claim(claiming));
    mocked(useClaimFirstWorkBadge).mockReturnValue(
      claim() as unknown as ReturnType<typeof useClaimFirstWorkBadge>
    );
    mocked(useClaimFirstSupportBadge).mockReturnValue(
      claim() as unknown as ReturnType<typeof useClaimFirstSupportBadge>
    );
    return resetHookMocks(
      usePrimaryAddress,
      useGreenGoodsEnsName,
      useEnsName,
      useProtocolMemberStatus,
      useMyOnlineWorks,
      useMyVaultDeposits,
      useGreenWillBadges,
      useClaimGenesisBadge,
      useClaimFirstWorkBadge,
      useClaimFirstSupportBadge
    );
  };
}

/**
 * Profile badges: earned badges and ones ready to claim. A claimable badge opens its sheet with the
 * claim as the one action in the shared bar (DL-016); an earned badge's sheet has no bar. Badge,
 * membership, and claim hooks are mocked per story.
 */
const meta: Meta<typeof ProfileBadges> = {
  title: "Client/Profile/ProfileBadges",
  component: ProfileBadges,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [
    (Story) => (
      <div className="flex min-h-[640px] flex-col gap-3 p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProfileBadges>;

export const BadgeGrid: Story = {
  beforeEach: withBadges(),
  play: async () => {
    const grid = within(await screen.findByTestId("profile-badge-grid"));
    await expect(grid.getByRole("button", { name: "View Genesis badge" })).toBeVisible();
    await expect(grid.getByRole("button", { name: "View First Work badge" })).toBeVisible();
  },
};

export const ClaimGenesis: Story = {
  beforeEach: withBadges(),
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "View Genesis badge" }));
    const sheet = within(await screen.findByRole("dialog", { name: "Genesis" }));
    const claimAction = sheet.getByRole("button", { name: "Claim Genesis" });
    await expect(claimAction).toHaveAttribute("data-emphasis", "primary");
    await userEvent.click(claimAction);
    await expect(mocked(useClaimGenesisBadge).mock.results.at(-1)?.value.mutate).toHaveBeenCalled();
  },
};

export const Claiming: Story = {
  beforeEach: withBadges({ claiming: true }),
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "View Genesis badge" }));
    const sheet = within(await screen.findByRole("dialog", { name: "Genesis" }));
    await expect(sheet.getByRole("button", { name: "Claim Genesis" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
  },
};

export const EarnedBadge: Story = {
  beforeEach: withBadges(),
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "View First Work badge" }));
    const sheet = await screen.findByRole("dialog", { name: "First Work" });
    await expect(sheet.querySelector('[data-component="SheetActions"]')).toBeNull();
  },
};
