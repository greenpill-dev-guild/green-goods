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
import { STORYBOOK_NOW_SECONDS, daysAgo } from "../../../../shared/.storybook/fixtures";
import { ProfileBadges } from "./Badges";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";

const ACCOUNT = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e" as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;
/** Midday UTC on 19 November 2025, so the issue day reads the same in every time zone. */
const ISSUED_AT = daysAgo(58) + 12 * 3_600;

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
    ownership: owned
      ? {
          id: `${DEFAULT_CHAIN_ID}-${badgeId}-${ACCOUNT}`,
          chainId: DEFAULT_CHAIN_ID,
          badgeId,
          owner: ACCOUNT,
          sourceRef: badgeId,
          issuer: ZERO,
          unlockTokenId: 7n,
          issuedAt: ISSUED_AT,
          definitionId: `${DEFAULT_CHAIN_ID}-${badgeId}`,
          lastGrantId: `${DEFAULT_CHAIN_ID}-grant-${badgeId}`,
        }
      : null,
  };
}

function claim(isPending = false) {
  return { mutate: fn(), reset: fn(), isPending } as unknown as ReturnType<
    typeof useClaimGenesisBadge
  >;
}

function withBadges({ claiming = false, failed = false, unknownDate = false } = {}) {
  return () => {
    const firstWork = badge("first-work", true);
    if (unknownDate) firstWork.ownership = null;
    const firstSupport = badge("first-support", true);
    firstSupport.ownership = null;
    const badges = [firstWork, firstSupport, badge("genesis", false)];
    mocked(usePrimaryAddress).mockReturnValue(ACCOUNT);
    mocked(useGreenGoodsEnsName).mockReturnValue({ data: "river.greengoods.eth" } as ReturnType<
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
    mocked(useClaimGenesisBadge).mockReturnValue({
      ...claim(claiming),
      isError: failed,
      error: failed ? new Error("execution reverted") : null,
    } as ReturnType<typeof useClaimGenesisBadge>);
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
 * Profile badges: earned badges and ones ready to claim. A badge opens a `tall` sheet with its
 * artwork, its standing and, when known, its issue date. A claimable badge's claim is the
 * one action in the shared bar (DL-016); an earned badge's sheet has no bar. The fixtures have no
 * Unlock collection, so the artwork shows each badge's own glyph. Badge, membership, and claim
 * hooks are mocked per story.
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
    const cards = grid.getAllByRole("button");
    await expect(cards).toHaveLength(3);
    const heights = cards.map((card) => card.getBoundingClientRect().height);
    await expect(new Set(heights).size).toBe(1);
    await expect(heights[0]).toBeGreaterThanOrEqual(224);
    await expect(cards[0].querySelector("time")).toBeVisible();
    await expect(cards[1].querySelector("time")).toBeNull();
  },
};

async function openBadge(index: number) {
  const grid = within(await screen.findByTestId("profile-badge-grid"));
  await userEvent.click(grid.getAllByRole("button")[index]);
  return screen.findByRole("dialog");
}

export const ClaimGenesis: Story = {
  beforeEach: withBadges(),
  play: async () => {
    const sheet = await openBadge(2);
    const claimAction = sheet.querySelector<HTMLButtonElement>('[data-emphasis="primary"]')!;
    await expect(claimAction).toBeVisible();
    await userEvent.click(claimAction);
    await expect(mocked(useClaimGenesisBadge).mock.results.at(-1)?.value.mutate).toHaveBeenCalled();
  },
};

export const Claiming: Story = {
  beforeEach: withBadges({ claiming: true }),
  play: async () => {
    const sheet = await openBadge(2);
    await expect(sheet.querySelector('[data-emphasis="primary"]')).toHaveAttribute(
      "aria-busy",
      "true"
    );
  },
};

export const EarnedBadge: Story = {
  beforeEach: withBadges(),
  play: async () => {
    const sheet = await openBadge(0);
    await expect(sheet.querySelector('[data-component="SheetActions"]')).toBeNull();
    await expect(sheet.querySelector("time")).toHaveAttribute(
      "datetime",
      "2025-11-19T12:00:00.000Z"
    );
  },
};

export const IssueDatePending: Story = {
  beforeEach: withBadges({ unknownDate: true }),
};

export const ClaimError: Story = {
  beforeEach: withBadges({ failed: true }),
  play: async () => {
    await openBadge(2);
    await expect(await screen.findByRole("alert")).toBeVisible();
  },
};
