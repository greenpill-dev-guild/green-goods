import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useCookieJarWithdraw } from "@green-goods/shared/hooks/cookie-jar/useCookieJarWithdraw";
import { useGardenCookieJars } from "@green-goods/shared/hooks/cookie-jar/useGardenCookieJars";
import { useGardenVaults } from "@green-goods/shared/hooks/vault/useGardenVaults";
import { useVaultDeposit } from "@green-goods/shared/hooks/vault/useVaultDeposit";
import { useVaultDeposits } from "@green-goods/shared/hooks/vault/useVaultDeposits";
import { useVaultPreview } from "@green-goods/shared/hooks/vault/useVaultPreview";
import { useVaultWithdraw } from "@green-goods/shared/hooks/vault/useVaultWithdraw";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenVault, VaultDeposit } from "@green-goods/shared/types/vaults";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, screen, userEvent, waitFor, within } from "storybook/test";
import { withWagmi } from "../../../../../shared/.storybook/decorators";
import { EndowmentSheet } from "./index";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";

const CHAIN_ID = DEFAULT_CHAIN_ID;
const GARDEN = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
const ACCOUNT = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e" as Address;
const DAI = "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1" as Address;
const VAULT = "0x6a3cdb6d6d9a7d4f4b62c1d0e6f1a7b0c2d9e4f5" as Address;
const JAR = "0x9b1f1f7a8e8a4c58a7e2b54c4c8f2e1a3d6b7c90" as Address;
const WEI = 10n ** 18n;

const vault: GardenVault = {
  id: `${CHAIN_ID}-${VAULT}`,
  chainId: CHAIN_ID,
  garden: GARDEN,
  asset: DAI,
  vaultAddress: VAULT,
  totalDeposited: 1_250n * WEI,
  totalWithdrawn: 150n * WEI,
  totalHarvestCount: 3,
  donationAddress: null,
  depositorCount: 8,
  paused: false,
  createdAt: 1_767_225_600,
};

const myDeposit: VaultDeposit = {
  id: `${CHAIN_ID}-${VAULT}-${ACCOUNT}`,
  chainId: CHAIN_ID,
  garden: GARDEN,
  asset: DAI,
  vaultAddress: VAULT,
  depositor: ACCOUNT,
  shares: 40n * WEI,
  totalDeposited: 40n * WEI,
  totalWithdrawn: 0n,
};

const jar: CookieJar = {
  jarAddress: JAR,
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

function mutation<T>(isPending = false) {
  return { mutate: fn(), mutateAsync: fn(), isPending, reset: fn() } as unknown as T;
}

function withEndowment({
  online = true,
  depositing = false,
  deposits = [] as VaultDeposit[],
} = {}) {
  return () => {
    mocked(useUser).mockReturnValue({ primaryAddress: ACCOUNT } as ReturnType<typeof useUser>);
    mocked(useOffline).mockReturnValue({ isOnline: online } as ReturnType<typeof useOffline>);
    mocked(useVaultDeposit).mockReturnValue(mutation(depositing));
    mocked(useVaultWithdraw).mockReturnValue(mutation());
    mocked(useCookieJarWithdraw).mockReturnValue(mutation());
    mocked(useGardenVaults).mockReturnValue({
      vaults: [vault],
      isLoading: false,
      isError: false,
      refetch: fn(),
    } as unknown as ReturnType<typeof useGardenVaults>);
    mocked(useVaultDeposits).mockReturnValue({ deposits } as unknown as ReturnType<
      typeof useVaultDeposits
    >);
    mocked(useVaultPreview).mockReturnValue({
      preview: {
        previewShares: 5n * WEI,
        previewAssets: 5n * WEI,
        maxDeposit: 10_000n * WEI,
        shareBalance: myDeposit.shares,
        totalAssets: 1_100n * WEI,
        maxWithdraw: 41n * WEI,
        previewWithdrawShares: 5n * WEI,
      },
    } as unknown as ReturnType<typeof useVaultPreview>);
    mocked(useGardenCookieJars).mockReturnValue({
      jars: [jar],
      isLoading: false,
      error: null,
      moduleConfigured: true,
      hasDetailReadFailure: false,
    } as unknown as ReturnType<typeof useGardenCookieJars>);
    return resetHookMocks(
      useUser,
      useOffline,
      useVaultDeposit,
      useVaultWithdraw,
      useCookieJarWithdraw,
      useGardenVaults,
      useVaultDeposits,
      useVaultPreview,
      useGardenCookieJars
    );
  };
}

// AppSheet renders an unnamed dialog, so the sheet is found by its test id.
const sheet = async () => within(await screen.findByTestId("app-sheet"));

/**
 * A garden's endowment: the vault treasury with its Deposit action pinned in the shared bar
 * (DL-016), the reader's own deposits with their withdraw confirmation, and the garden cookie jar
 * with its claim confirmation. Vault, jar, and wallet hooks are mocked per story; wallet balance
 * reads resolve empty, so Deposit waits for a balance.
 */
const meta: Meta<typeof EndowmentSheet> = {
  title: "Client/Sheets/EndowmentSheet",
  component: EndowmentSheet,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: {
    isOpen: true,
    onClose: fn(),
    gardenAddress: GARDEN,
    gardenName: "Green Goods Community Garden",
  },
  decorators: [withWagmi],
};

export default meta;
type Story = StoryObj<typeof EndowmentSheet>;

export const Treasury: Story = {
  beforeEach: withEndowment(),
  play: async () => {
    const endowment = await sheet();
    await expect(endowment.getByRole("button", { name: "Deposit" })).toBeDisabled();
    await waitFor(() =>
      expect(endowment.getByRole("textbox", { name: "Amount to deposit" })).toBeVisible()
    );
  },
};

export const Depositing: Story = {
  beforeEach: withEndowment({ depositing: true }),
  play: async () => {
    const endowment = await sheet();
    await expect(endowment.getByRole("button", { name: "Deposit" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
  },
};

export const Offline: Story = {
  beforeEach: withEndowment({ online: false }),
  play: async () => {
    const endowment = await sheet();
    await waitFor(() => expect(endowment.getByRole("status")).toBeVisible());
    await expect(endowment.getByRole("button", { name: "Deposit" })).toBeDisabled();
  },
};

export const WithdrawConfirm: Story = {
  beforeEach: withEndowment({ deposits: [myDeposit] }),
  play: async () => {
    const endowment = await sheet();
    await userEvent.type(endowment.getByRole("textbox", { name: "Amount to withdraw" }), "5");
    await userEvent.click(endowment.getByRole("button", { name: "Withdraw" }));
    const confirm = within(await screen.findByRole("alertdialog", { name: "Confirm Withdrawal" }));
    await expect(confirm.getByRole("button", { name: "Confirm Withdrawal" })).toHaveAttribute(
      "data-tone",
      "warning"
    );
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeVisible();
  },
};

export const CookieJarClaimConfirm: Story = {
  beforeEach: withEndowment(),
  play: async () => {
    const endowment = await sheet();
    await userEvent.click(endowment.getByRole("tab", { name: "Cookie jar" }));
    await userEvent.click(await endowment.findByRole("button", { name: /DAI/ }));
    await userEvent.type(endowment.getByRole("textbox", { name: "How much" }), "2");
    await userEvent.type(
      endowment.getByRole("textbox", { name: "Purpose" }),
      "Seedlings for the nursery"
    );
    await userEvent.click(endowment.getByRole("button", { name: "Claim" }));
    const confirm = within(await screen.findByRole("alertdialog", { name: "Confirm Claim" }));
    await expect(
      confirm.getByText("Take 2 DAI from Green Goods Community Garden's cookie jar?")
    ).toBeVisible();
    await expect(confirm.getByRole("button", { name: "Claim" })).toBeVisible();
  },
};
