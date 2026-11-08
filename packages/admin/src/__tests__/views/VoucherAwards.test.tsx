import { describe, expect, it, vi } from "vitest";
import {
  VoucherAwardDialog,
  type VoucherAwardDialogProps,
} from "../../views/Garden/Pool/VoucherAwardDialog";
import { awardStoryRecord as record } from "../../views/Garden/Pool/voucherAwardStoryFixtures";
import { render, screen, userEvent, waitFor, fireEvent } from "../test-utils";
vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: { show: vi.fn(), success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
const props = (): VoucherAwardDialogProps => ({
  issuer: {
    name: "Hub days",
    decimals: 6,
    reserve: record.award.reserve,
    token: record.award.token,
  },
  records: [],
  busy: false,
  disabled: false,
  directSigningAvailable: true,
  onClose: vi.fn(),
  onLoad: vi.fn().mockResolvedValue(undefined),
  onPrepare: vi.fn().mockResolvedValue(record),
  onSend: vi.fn().mockResolvedValue({ record, operation: null }),
  onRecover: vi.fn().mockResolvedValue({ record, operation: null }),
  onReconcile: vi.fn().mockResolvedValue(record),
});
describe("steward awards", () => {
  it("loads only explicitly and reviews the exact award before preparing; preparing never sends", async () => {
    const actions = props();
    render(<VoucherAwardDialog {...actions} />);
    expect(actions.onLoad).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Load Award History" }));
    expect(actions.onLoad).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByRole("textbox", { name: "Recipient account" }), {
      target: { value: record.award.recipient },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Voucher amount" }), {
      target: { value: "1.5" },
    });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Contribution recognized" }),
      "Past design contribution"
    );
    await userEvent.click(screen.getByRole("button", { name: "Review Award" }));
    expect(actions.onPrepare).not.toHaveBeenCalled();
    expect(screen.getByText(record.award.token)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Prepare Award" }));
    await waitFor(() => expect(actions.onPrepare).toHaveBeenCalledOnce());
    expect(actions.onPrepare).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: record.award.recipient,
        amount: "1500000",
        reason: "Past design contribution",
        reserve: record.award.reserve,
        token: record.award.token,
      })
    );
    expect(actions.onSend).not.toHaveBeenCalled();
  });
  it("checks a loaded record before offering another send and keeps uncertain delivery unresolved", async () => {
    const actions = props();
    actions.records = [record];
    actions.onRecover = vi.fn().mockResolvedValue({ record, operation: { status: "unresolved" } });
    render(<VoucherAwardDialog {...actions} />);
    await userEvent.click(screen.getByRole("button", { name: /Design work completed/ }));
    expect(screen.queryByRole("button", { name: "Sign and Send Award" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Check Pending Transaction" }));
    await waitFor(() =>
      expect(
        screen.getByText(
          "Delivery is unconfirmed. Check the pending transaction before signing again."
        )
      ).toBeInTheDocument()
    );
    expect(actions.onRecover).toHaveBeenCalledExactlyOnceWith(record);
    expect(actions.onSend).not.toHaveBeenCalled();
    expect(screen.queryByText("Confirmed delivery")).not.toBeInTheDocument();
  });
  it("requires a Safe handoff for multiple signers and reconciles an explicit transaction", async () => {
    const actions = props();
    const multisig = { ...record, safe: { ...record.safe, threshold: 2 } };
    actions.records = [multisig];
    render(<VoucherAwardDialog {...actions} />);
    await userEvent.click(screen.getByRole("button", { name: /Design work completed/ }));
    await userEvent.click(screen.getByRole("button", { name: "Check Pending Transaction" }));
    expect(screen.queryByRole("button", { name: "Sign and Send Award" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Safe Handoff" })).toBeEnabled();
    const hash = `0x${"b".repeat(64)}`;
    fireEvent.change(screen.getByRole("textbox", { name: "Executed transaction hash" }), {
      target: { value: hash },
    });
    await userEvent.click(screen.getByRole("button", { name: "Verify Safe Receipt" }));
    expect(actions.onReconcile).toHaveBeenCalledExactlyOnceWith(multisig, hash);
  });
  it("keeps the prepared identity for retries and explains reserve shortages", async () => {
    const actions = props();
    actions.onPrepare = vi.fn().mockRejectedValue(new Error("insufficient_reserve"));
    render(<VoucherAwardDialog {...actions} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Recipient account" }), {
      target: { value: record.award.recipient },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Voucher amount" }), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Contribution recognized" }), {
      target: { value: "Past work" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Review Award" }));
    await userEvent.click(screen.getByRole("button", { name: "Prepare Award" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("reserve does not hold enough");
    await userEvent.click(screen.getByRole("button", { name: "Prepare Award" }));
    const calls = vi.mocked(actions.onPrepare).mock.calls;
    expect(calls[0]![0].awardId).toBe(calls[1]![0].awardId);
  });
});
