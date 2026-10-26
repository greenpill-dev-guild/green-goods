import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentType } from "react";
import { IntlProvider } from "react-intl";
import { expect, screen, userEvent, within } from "storybook/test";
import { VoucherRaiseAllowanceDialog } from "./VoucherRaiseAllowanceDialog";
import {
  STORY_TECH_AND_SUN_SAFE,
  STORY_TECH_AND_SUN_SHORT,
  nameVoucherMembers,
} from "./poolStoryVouchers";

function inLocale(locale: "es" | "pt") {
  return (Story: ComponentType) => (
    <IntlProvider locale={locale} messages={locale === "es" ? esMessages : ptMessages}>
      <Story />
    </IntlProvider>
  );
}

const meta: Meta<typeof VoucherRaiseAllowanceDialog> = {
  title: "Admin/Pool/VoucherRaiseAllowanceDialog",
  component: VoucherRaiseAllowanceDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Raise Allowance (PRD-1297 surface 6, `SIssuer`), opened from Your Reserve when a promised reward waits: lets the funding garden's promised rewards draw more from the reserve. It creates no vouchers; the waiting reward is then retried and sent once. The field starts at the garden's allowance again plus what waits and takes only more than is left; the Safe's signature count comes from the Safe. Balances and Riverside Commons are fictional.",
      },
    },
  },
  args: {
    reserve: STORY_TECH_AND_SUN_SHORT.reserve,
    safe: STORY_TECH_AND_SUN_SAFE,
    tone: "garden",
    onClose: () => undefined,
    onRaise: async () => undefined,
  },
  beforeEach: nameVoucherMembers,
};

export default meta;
type Story = StoryObj<typeof VoucherRaiseAllowanceDialog>;

/** Riverside Commons' 4 are used up and Lina's 2 wait: the field starts at 6. */
export const RaiseAllowance: Story = {
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByText("Raise the Allowance for Riverside Commons")).toBeVisible();
    await expect(dialog.getByLabelText("New allowance")).toHaveValue("6");
    await expect(dialog.getByRole("button", { name: "Raise Allowance" })).toBeEnabled();
  },
};

/** Nothing more than what's left isn't a raise: the field says so, and Raise stays off. */
export const TooLow: Story = {
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    const field = dialog.getByLabelText("New allowance");
    await userEvent.clear(field);
    await userEvent.type(field, "0");
    await expect(await dialog.findByText("More than the 0 left now")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Raise Allowance" })).toBeDisabled();
  },
};

export const RaiseAllowanceEs: Story = { decorators: [inLocale("es")] };
export const RaiseAllowancePt: Story = { decorators: [inLocale("pt")] };
