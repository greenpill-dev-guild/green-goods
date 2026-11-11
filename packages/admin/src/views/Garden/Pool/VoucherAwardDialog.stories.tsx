import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import { VoucherAwardDialog, type VoucherAwardDialogProps } from "./VoucherAwardDialog";
import { awardStoryRecord } from "./voucherAwardStoryFixtures";
const record = awardStoryRecord;
/** Storybook resets mocks between renders, so initialize every asynchronous result per run. */
function initializeCallbacks(args: VoucherAwardDialogProps, unresolved = false) {
  const reviewed = args.records[0] ?? record;
  mocked(args.onLoad).mockReset().mockResolvedValue(undefined);
  mocked(args.onPrepare).mockReset().mockResolvedValue(reviewed);
  mocked(args.onSend)
    .mockReset()
    .mockResolvedValue({ record: reviewed, operation: { status: "unresolved" } });
  mocked(args.onRecover)
    .mockReset()
    .mockResolvedValue({
      record: reviewed,
      operation: unresolved ? { status: "unresolved" } : null,
    });
  mocked(args.onReconcile).mockReset().mockResolvedValue(reviewed);
}
const meta: Meta<typeof VoucherAwardDialog> = {
  title: "Admin/Pool/VoucherAwards",
  component: VoucherAwardDialog,
  tags: ["autodocs"],
  beforeEach: ({ args }) => initializeCallbacks(args),
  argTypes: { records: { control: false }, issuer: { control: false } },
  args: {
    issuer: {
      name: "Fictional hub days",
      decimals: 6,
      reserve: record.award.reserve,
      token: record.award.token,
    },
    records: [record],
    busy: false,
    disabled: false,
    directSigningAvailable: true,
    onClose: fn(),
    onLoad: fn(),
    onPrepare: fn(),
    onSend: fn(),
    onRecover: fn(),
    onReconcile: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof VoucherAwardDialog>;
export const Review: Story = {
  play: async ({ canvasElement }) => {
    const ui = within(canvasElement.ownerDocument.body);
    await userEvent.type(
      ui.getByRole("textbox", { name: "Recipient account" }),
      record.award.recipient
    );
    await userEvent.type(ui.getByRole("textbox", { name: "Voucher amount" }), "2");
    await userEvent.type(
      ui.getByRole("textbox", { name: "Contribution recognized" }),
      record.award.reason
    );
    await userEvent.click(ui.getByRole("button", { name: "Review Award" }));
    await expect(ui.getByRole("button", { name: "Prepare Award" })).toBeVisible();
  },
};
export const SafeHandoff: Story = {
  args: { records: [{ ...record, safe: { ...record.safe, threshold: 2 } }] },
  play: async ({ canvasElement }) => {
    const ui = within(canvasElement.ownerDocument.body);
    await userEvent.click(ui.getByRole("button", { name: /Design work completed/ }));
    await expect(ui.getByRole("button", { name: "Copy Safe Handoff" })).toBeVisible();
    await expect(ui.queryByRole("button", { name: "Sign and Send Award" })).toBeNull();
  },
};
export const UncertainDelivery: Story = {
  beforeEach: ({ args }) => initializeCallbacks(args, true),
  play: async ({ canvasElement }) => {
    const ui = within(canvasElement.ownerDocument.body);
    await userEvent.click(ui.getByRole("button", { name: /Design work completed/ }));
    await userEvent.click(ui.getByRole("button", { name: "Check Pending Transaction" }));
    await expect(
      await ui.findByText(
        "Delivery is unconfirmed. Check the pending transaction before signing again."
      )
    ).toBeVisible();
  },
};
