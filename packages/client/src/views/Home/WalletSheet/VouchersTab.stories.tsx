import type { VoucherWalletSnapshot } from "@green-goods/shared/commitment-pooling";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { IntlProvider } from "react-intl";
import { expect, fn, screen, userEvent } from "storybook/test";
import { withDataRouter, withSeededQueryClient } from "../../../../../shared/.storybook/decorators";
import { voucherWalletStory } from "../../../../../shared/.storybook/voucherPilotFixtures";
import { VouchersTab } from "./VouchersTab";

/** The offers the stories' bookings belong to, with their titles as their issuers wrote them. */
const OFFERS: ReadonlyArray<readonly [bigint, string, string]> = [
  [1023n, "bafy-hub-day", "Hub day, up to 4 hours"],
  [1027n, "bafy-claude", "Claude access, 30 days"],
];
const SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = OFFERS.flatMap(
  ([commitmentId, cid, title]) => [
    [
      queryKeys.commitmentPooling.commitment(42161, commitmentId),
      { commitment: { metadataCID: cid } },
    ],
    [queryKeys.commitmentPooling.metadata(cid), { version: 1, title }],
  ]
);

function inLocale(locale: "es" | "pt") {
  return (Story: ComponentType) => (
    <IntlProvider locale={locale} messages={locale === "es" ? esMessages : ptMessages}>
      <Story />
    </IntlProvider>
  );
}

const returnFailed = (): VoucherWalletSnapshot => {
  const wallet = voucherWalletStory("returnPending");
  return {
    ...wallet,
    returns: wallet.returns.map((back) => ({ ...back, state: "failed" as const, attempts: 1n })),
  };
};

/**
 * The wallet's Vouchers tab (PRD-1297 surface 4, `SWallet`), after Cookies and Tokens. What the
 * account holds of each issuer sits on an item row with its amount in the right slot, opening in
 * place to book from the issuer's garden (DL-113). A voucher a booking holds is its own row that
 * opens the booking at its garden, whatever garden Home has active (decision 11), and a return
 * on its way is a pending row until it arrives. Fictional accounts; the working pilot issuers.
 */
const meta: Meta<typeof VouchersTab> = {
  title: "Client/Wallet/VouchersTab",
  component: VouchersTab,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: { wallet: voucherWalletStory("vouchers"), onClose: fn() },
  decorators: [
    (Story) => (
      <div className="flex h-[717px] flex-col overflow-hidden border border-stroke-soft-200 bg-bg-white-0">
        <Story />
      </div>
    ),
    withSeededQueryClient(SEEDS),
    withDataRouter("/home"),
  ],
};

export default meta;
type Story = StoryObj<typeof VouchersTab>;

/** Nine Tech and Sun vouchers and two Green Goods vouchers, each available to book with. */
export const Vouchers: Story = {
  play: async () => {
    await expect(
      await screen.findByRole("button", { name: /Tech and Sun vouchers/ })
    ).toBeVisible();
  },
};

/** A holding opened in place: who issued it, and Book a Service in the issuer's garden. */
export const VoucherOpen: Story = {
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: /Tech and Sun vouchers/ }));
    await expect(await screen.findByRole("button", { name: "Book a Service" })).toBeVisible();
  },
};

/** A hub day booked: the voucher its escrow holds is its own row, which opens the booking. */
export const Booked: Story = {
  args: { wallet: voucherWalletStory("booked") },
  play: async () => {
    await expect(await screen.findByText("Hub day, up to 4 hours")).toBeVisible();
    await expect(screen.getByText("in a booking")).toBeVisible();
  },
};

/** Claude access ended early: 6 Green Goods vouchers on their way back, pending until they arrive. */
export const ReturnPending: Story = {
  args: { wallet: voucherWalletStory("returnPending") },
  play: async () => {
    await expect(await screen.findByRole("button", { name: /6 coming back/ })).toBeVisible();
  },
};

/** The return's transfer didn't go through; its row opens the booking, where anyone can retry. */
export const ReturnFailed: Story = {
  args: { wallet: returnFailed() },
};

/** The read can't yet see every booking, so the list says it may be missing one. */
export const Partial: Story = {
  args: { wallet: { ...voucherWalletStory("booked"), complete: false } },
};

/** No issuer's vouchers yet. */
export const Empty: Story = {
  args: { wallet: { ...voucherWalletStory("empty"), issuers: [], holdings: [] } },
};

export const VoucherOpenEs: Story = {
  ...VoucherOpen,
  decorators: [inLocale("es")],
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: /vales de Tech and Sun/ }));
  },
};

export const VoucherOpenPt: Story = {
  ...VoucherOpen,
  decorators: [inLocale("pt")],
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: /vales da Tech and Sun/ }));
  },
};

export const BookedEs: Story = { ...Booked, decorators: [inLocale("es")], play: undefined };

export const BookedPt: Story = { ...Booked, decorators: [inLocale("pt")], play: undefined };

export const ReturnPendingEs: Story = {
  ...ReturnPending,
  decorators: [inLocale("es")],
  play: undefined,
};

export const ReturnPendingPt: Story = {
  ...ReturnPending,
  decorators: [inLocale("pt")],
  play: undefined,
};
