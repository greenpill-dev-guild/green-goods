import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentType } from "react";
import { IntlProvider } from "react-intl";
import { expect, screen, userEvent, within } from "storybook/test";
import { VoucherProposeReturnDialog } from "./VoucherProposeReturnDialog";
import { STORY_GREEN_GOODS_SAFE, STORY_LINA_ENDED, nameVoucherMembers } from "./poolStoryVouchers";

function inLocale(locale: "es" | "pt") {
  return (Story: ComponentType) => (
    <IntlProvider locale={locale} messages={locale === "es" ? esMessages : ptMessages}>
      <Story />
    </IntlProvider>
  );
}

const meta: Meta<typeof VoucherProposeReturnDialog> = {
  title: "Admin/Pool/VoucherProposeReturnDialog",
  component: VoucherProposeReturnDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Propose Return (PRD-1297 surface 6, `SIssuer`), opened from the row of Claude access that ended early: the issuer sets the most that can come back to the holder. It starts at what the issuer's terms allow, refuses more (Above terms), shows the split between the holder and the issuer's reserve, and says nothing moves until the holder approves a split. The Safe's signature count comes from the Safe. The people and moments are fictional.",
      },
    },
  },
  args: {
    booking: STORY_LINA_ENDED,
    title: "Claude access, 30 days",
    safe: STORY_GREEN_GOODS_SAFE,
    disabled: false,
    tone: "garden",
    onClose: () => undefined,
    onPropose: async () => undefined,
  },
  beforeEach: nameVoucherMembers,
};

export default meta;
type Story = StoryObj<typeof VoucherProposeReturnDialog>;

/** Lina's access stopped after 12 days; the terms allow 6 of her 10 vouchers back. */
export const ProposeReturn: Story = {
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByLabelText("Back to Lina")).toHaveValue("6");
    await expect(dialog.getByTestId("voucher-return-split")).toHaveAccessibleName(
      "4 to your reserve, 6 back to Lina"
    );
    await expect(dialog.getByText("Your Safe needs 2 of 5 signatures.")).toBeVisible();
  },
};

/** Seven is above the six the terms allow after 12 days: the field says so, and Propose stays off. */
export const AboveTerms: Story = {
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    const field = dialog.getByLabelText("Back to Lina");
    await userEvent.clear(field);
    await userEvent.type(field, "7");
    await expect(
      await dialog.findByText("Above the 6 your terms allow after 12 days")
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Propose Return" })).toBeDisabled();
  },
};

export const ProposeReturnEs: Story = { decorators: [inLocale("es")] };
export const ProposeReturnPt: Story = { decorators: [inLocale("pt")] };
