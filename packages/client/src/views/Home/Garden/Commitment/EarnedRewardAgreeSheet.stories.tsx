import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent } from "storybook/test";
import { EarnedRewardAgreeSheet } from "./EarnedRewardAgreeSheet";

/**
 * Agree to the Rewards (PRD-1299 SReward · Agree): before taking up a request with a voucher
 * reward, the member agrees to the exact reward from their own account. An open request is
 * theirs once taken up; a reviewed one waits for its stewards, and the consent line says which.
 */
const meta: Meta<typeof EarnedRewardAgreeSheet> = {
  title: "Client/Commitments/EarnedRewardAgreeSheet",
  component: EarnedRewardAgreeSheet,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: {
    open: true,
    work: "Complete the UN CC:Learn climate course",
    outcome: null,
    isPending: false,
    onOpenChange: fn(),
    onAgree: fn(),
    sheet: {
      title: "Agree to the Rewards",
      work: "Work",
      vouchers: "Vouchers",
      value: "1 Tech and Sun voucher to your account",
      detail: "From Tech and Sun's reserve, which Tech and Sun lets TAS HUB use",
      consent:
        "Agreeing records these exact rewards. Then you take the promise up, and it's yours right away.",
      cta: "Agree and Take It Up",
    },
  },
};

export default meta;
type Story = StoryObj<typeof EarnedRewardAgreeSheet>;

export const OpenRequest: Story = {
  play: async ({ args }) => {
    await expect(await screen.findByRole("dialog", { name: "Agree to the Rewards" })).toBeVisible();
    await expect(screen.getByText("1 Tech and Sun voucher to your account")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Agree and Take It Up" }));
    await expect(args.onAgree).toHaveBeenCalledTimes(1);
  },
};

export const RewardChanged: Story = {
  args: { outcome: "changed" },
  play: async () => {
    await expect(await screen.findByText("The terms changed. Review them again.")).toBeVisible();
  },
};

export const BeforeServiceBooking: Story = {
  args: {
    work: "Host a community workshop about soil care, record what the participants learn, and share the practical steps with the garden before the next planting season",
    sheet: {
      ...meta.args!.sheet!,
      consent:
        "Agreeing records these exact rewards. Then review and agree to the service booking.",
      cta: "Agree to the Rewards",
    },
  },
  play: async ({ args }) => {
    await expect(await screen.findByRole("dialog", { name: "Agree to the Rewards" })).toBeVisible();
    await expect(screen.getByTitle(args.work)).toBeVisible();
    await expect(screen.getByText(args.sheet.consent)).toBeVisible();
  },
};

export const NothingSent: Story = {
  args: { outcome: "nothingSent" },
  play: async () => {
    await expect(await screen.findByText("Nothing was sent.")).toBeVisible();
  },
};

export const Agreeing: Story = {
  args: { isPending: true },
  play: async () => {
    await expect(
      await screen.findByRole("button", { name: "Agree and Take It Up" })
    ).toHaveAttribute("aria-busy", "true");
  },
};
