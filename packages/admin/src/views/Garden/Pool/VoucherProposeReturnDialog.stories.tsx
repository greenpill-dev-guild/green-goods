import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentType } from "react";
import { IntlProvider } from "react-intl";
import { expect, screen, userEvent, within } from "storybook/test";
import { VoucherProposeReturnDialog } from "./VoucherProposeReturnDialog";
import {
  STORY_GREEN_GOODS_SAFE,
  STORY_LINA_ENDED,
  STORY_MARA_VISIT_ENDED,
  STORY_TECH_AND_SUN_SAFE,
  nameVoucherMembers,
} from "./poolStoryVouchers";

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
          "Propose Return (PRD-1297 surface 6, `SIssuer`), opened from the row of Claude access that ended early: the issuer sets the most that can come back to the holder. It starts at what the issuer's terms allow, refuses more (Above terms) and anything that doesn't raise the ceiling the escrow already keeps, counts a hub day in usable hours and access in days, shows the split between the holder and the issuer's reserve, and says nothing moves until the holder approves a split. The Safe's signature count comes from the Safe. The people and moments are fictional.",
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

/** Mara's hub day stopped after 2 of its 4 usable hours: the return counts hours, up to half a voucher. */
export const VisitEndedEarly: Story = {
  args: {
    booking: STORY_MARA_VISIT_ENDED,
    title: "Hub day, up to 4 hours",
    safe: STORY_TECH_AND_SUN_SAFE,
  },
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(
      dialog.getByText("Hub day, up to 4 hours · stopped after 2 of 4 hours")
    ).toBeVisible();
    await expect(dialog.getByText("Your terms allow up to 0.5 after 2 of 4 hours")).toBeVisible();
    await expect(dialog.getByTestId("voucher-return-split")).toHaveAccessibleName(
      "0.5 to your reserve, 0.5 back to Mara"
    );
  },
};

/** Four already came back under an earlier proposal: the escrow keeps that ceiling, so only more counts. */
export const BelowCeiling: Story = {
  args: {
    booking: {
      ...STORY_LINA_ENDED,
      stage: { kind: "ended-early", returnLimit: 6_000_000n, returnCeiling: 4_000_000n },
    },
  },
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    const field = dialog.getByLabelText("Back to Lina");
    await userEvent.clear(field);
    await userEvent.type(field, "4");
    await expect(await dialog.findByText("More than the 4 already proposed")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Propose Return" })).toBeDisabled();
  },
};

/** Another act went to the wallet with the dialog open: Propose Return waits, as the row's act does. */
export const ProposeReturnBusy: Story = {
  args: { disabled: true },
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByRole("button", { name: "Propose Return" })).toBeDisabled();
  },
};

/** Canonical units have no invented visit schedule, elapsed days or published refund policy. */
export const SafeFileReturn: Story = {
  args: {
    booking: {
      ...STORY_LINA_ENDED,
      issuer: { ...STORY_LINA_ENDED.issuer, execution: "safe-file" },
      service: { kind: "units", units: 1n, label: "visits", returnLimit: 10_000_000n },
      stage: { kind: "in-progress" },
    },
    title: "Garden visit",
  },
};
