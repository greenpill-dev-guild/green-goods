import { createIntl } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));

vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({ toastService: toast }));

const { toastRewardPayOutcome } = await import(
  "../../views/Garden/Pool/CommitmentDialog/usdcShareToasts"
);

const { formatMessage } = createIntl({ locale: "en", messages: {}, onError: () => {} });
const told = () =>
  [...toast.success.mock.calls, ...toast.info.mock.calls, ...toast.error.mock.calls].map(
    ([options]) => options
  );

describe("what the Hub tells an owner once their step towards a Safe payment ends", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts an approval only once it has landed", () => {
    toastRewardPayOutcome(
      { status: "approved", approvals: 1, threshold: 2, confirmed: false },
      formatMessage
    );
    expect(told()).toEqual([
      {
        title: "Approval sent, not confirmed yet",
        message: "It counts towards the payment once it lands.",
      },
    ]);
  });

  it("says how many owners approved, and that one of them presses Pay once enough have", () => {
    toastRewardPayOutcome(
      { status: "approved", approvals: 1, threshold: 2, confirmed: true },
      formatMessage
    );
    expect(told()).toEqual([
      {
        title: "Approval sent",
        message: "1 of 2 Safe owners have approved. Once enough approve, any owner presses Pay.",
      },
    ]);
  });

  it("reports a payment that may still land as sent, never as paid", () => {
    toastRewardPayOutcome(
      { status: "unconfirmed", transactionHash: null, shareIds: [] },
      formatMessage
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(told()).toEqual([expect.objectContaining({ title: "Sent, not confirmed yet" })]);
  });

  it("says nothing when the owner declined to sign", () => {
    toastRewardPayOutcome({ status: "not-paid", miss: "declined" }, formatMessage);
    expect(told()).toEqual([]);
  });
});
