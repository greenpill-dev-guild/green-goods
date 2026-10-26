import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentType } from "react";
import { IntlProvider } from "react-intl";
import { expect, screen, userEvent, within } from "storybook/test";
import { VoucherReserveCard } from "./VoucherReserveCard";
import {
  STORY_GREEN_GOODS_VOUCHERS,
  STORY_TECH_AND_SUN_SHORT,
  STORY_TECH_AND_SUN_VOUCHERS,
  nameVoucherMembers,
} from "./poolStoryVouchers";

function inLocale(locale: "es" | "pt") {
  return (Story: ComponentType) => (
    <IntlProvider locale={locale} messages={locale === "es" ? esMessages : ptMessages}>
      <Story />
    </IntlProvider>
  );
}

const meta: Meta<typeof VoucherReserveCard> = {
  title: "Admin/Pool/VoucherReserveCard",
  component: VoucherReserveCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Your Reserve (PRD-1297 surface 6, `SIssuer`), in the rail of an issuing garden's Promises tab under Review Promises: the vouchers its promised rewards draw on, kept apart from bookings, the funding garden's allowance, the service terms, the Safe's approvals read from the Safe, and the published cap. When the allowance can't cover a promised reward, the reward waits and Raise Allowance… repairs it. Balances and Riverside Commons are fictional.",
      },
    },
  },
  args: {
    reserve: STORY_TECH_AND_SUN_VOUCHERS.reserve!,
    safe: STORY_TECH_AND_SUN_VOUCHERS.safe,
    disabled: false,
    tone: "garden",
    onRaiseAllowance: async () => undefined,
  },
  beforeEach: nameVoucherMembers,
  decorators: [
    (Story) => (
      <div className="max-w-md p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof VoucherReserveCard>;

/** Tech and Sun's reserve: 8 vouchers, 2 of Riverside Commons' 4 left, one signature per booking. */
export const TechAndSun: Story = {};

/** Green Goods' reserve, where the Safe signs two of five. */
export const GreenGoods: Story = {
  args: {
    reserve: STORY_GREEN_GOODS_VOUCHERS.reserve!,
    safe: STORY_GREEN_GOODS_VOUCHERS.safe,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Your Safe signs each one, 2 of 5 signatures")
    ).toBeVisible();
  },
};

/** Riverside Commons' allowance is used up: Lina's reward waits, and the card offers the repair. */
export const ReserveShort: Story = {
  args: { reserve: STORY_TECH_AND_SUN_SHORT.reserve! },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement);
    await expect(card.getByText("Lina’s reward of 2 vouchers is waiting.")).toBeVisible();
    await expect(card.getByRole("button", { name: "Raise Allowance…" })).toBeEnabled();
  },
};

/** Raising it: the dialog starts at the garden's 4 again plus the 2 that wait, and creates no vouchers. */
export const RaiseAllowance: Story = {
  args: { reserve: STORY_TECH_AND_SUN_SHORT.reserve! },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Raise Allowance…" }));
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByLabelText("New allowance")).toHaveValue("6");
    await expect(dialog.getByText("Your Safe needs 1 signature.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Raise Allowance" })).toBeEnabled();
  },
};

/** The Safe can't be read: the card says the Safe signs each booking, without a count. */
export const SafeUnread: Story = {
  args: { safe: { status: "unavailable" } },
};

export const ReserveShortEs: Story = {
  args: { reserve: STORY_TECH_AND_SUN_SHORT.reserve! },
  decorators: [inLocale("es")],
};

export const ReserveShortPt: Story = {
  args: { reserve: STORY_TECH_AND_SUN_SHORT.reserve! },
  decorators: [inLocale("pt")],
};
