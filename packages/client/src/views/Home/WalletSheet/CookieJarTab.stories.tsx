import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useAccessibleCookieJars } from "@green-goods/shared/hooks/cookie-jar/useAccessibleCookieJars";
import { useCookieJarWithdraw } from "@green-goods/shared/hooks/cookie-jar/useCookieJarWithdraw";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, screen, userEvent, within } from "storybook/test";
import { CookieJarTab } from "./CookieJarTab";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";

const GARDEN = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
const DAI = "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1" as Address;
const WEI = 10n ** 18n;

const jar: CookieJar = {
  jarAddress: "0x9b1f1f7a8e8a4c58a7e2b54c4c8f2e1a3d6b7c90" as Address,
  gardenAddress: GARDEN,
  assetAddress: DAI,
  balance: 12n * WEI,
  currency: DAI,
  decimals: 18,
  maxWithdrawal: 4n * WEI,
  withdrawalInterval: 604_800n,
  minDeposit: 0n,
  isPaused: false,
  emergencyWithdrawalEnabled: false,
};

function withJars({ claiming = false, online = true } = {}) {
  return () => {
    mocked(useOffline).mockReturnValue({ isOnline: online } as ReturnType<typeof useOffline>);
    mocked(useGardens).mockReturnValue({
      data: [{ id: GARDEN, tokenAddress: GARDEN, name: "Green Goods Community Garden" }],
    } as unknown as ReturnType<typeof useGardens>);
    mocked(useAccessibleCookieJars).mockReturnValue({
      jars: [jar],
      isLoading: false,
      moduleConfigured: true,
      eligibleGardenCount: 1,
      confirmedGardenCount: 1,
      unconfirmedGardenCount: 0,
      eligibilityErrorCount: 0,
      hasEligibilityReadFailure: false,
      jarAddressErrorCount: 0,
      hasJarAddressReadFailure: false,
      detailErrorCount: 0,
      hasDetailReadFailure: false,
      decimalsErrorCount: 0,
      hasDecimalsReadFailure: false,
    } as unknown as ReturnType<typeof useAccessibleCookieJars>);
    mocked(useCookieJarWithdraw).mockReturnValue({
      mutate: fn(),
      isPending: claiming,
    } as unknown as ReturnType<typeof useCookieJarWithdraw>);
    return resetHookMocks(useOffline, useGardens, useAccessibleCookieJars, useCookieJarWithdraw);
  };
}

async function fillClaim() {
  await userEvent.click(await screen.findByRole("button", { expanded: false }));
  await userEvent.type(screen.getByRole("textbox", { name: "How much" }), "2");
  await userEvent.type(
    screen.getByRole("textbox", { name: /Purpose/ }),
    "Seedlings for the nursery"
  );
}

/**
 * The wallet's cookie jar tab: jars the reader can claim from, grouped by garden. Claiming takes an
 * amount and a purpose, then asks to confirm with Claim over an outlined Cancel in the shared bar
 * (DL-016). Jar access and the claim mutation are mocked.
 */
const meta: Meta<typeof CookieJarTab> = {
  title: "Client/Wallet/CookieJarTab",
  component: CookieJarTab,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [
    (Story) => (
      <div className="flex h-[717px] flex-col overflow-hidden border border-stroke-soft-200 bg-bg-white-0">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CookieJarTab>;

export const ClaimableJar: Story = {
  beforeEach: withJars(),
  play: async () => {
    await expect(await screen.findByText("Green Goods Community Garden")).toBeVisible();
    await fillClaim();
    await expect(screen.getByRole("button", { name: "Claim" })).toBeEnabled();
  },
};

export const ClaimConfirm: Story = {
  beforeEach: withJars(),
  play: async () => {
    await fillClaim();
    await userEvent.click(screen.getByRole("button", { name: "Claim" }));
    const confirm = within(await screen.findByRole("alertdialog", { name: "Confirm Claim" }));
    await expect(
      confirm.getByText("Take 2 DAI from Green Goods Community Garden's cookie jar?")
    ).toBeVisible();
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeVisible();
  },
};

export const Claiming: Story = {
  beforeEach: withJars({ claiming: true }),
  play: async () => {
    await fillClaim();
    await expect(screen.getByRole("button", { name: "Claim" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
  },
};
