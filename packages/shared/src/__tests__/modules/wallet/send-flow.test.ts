import { describe, expect, it } from "vitest";
import {
  initialSendFlowState,
  sendFlowReducer,
  type SelectedRecipient,
} from "../../../modules/wallet/send-flow";

const recipient: SelectedRecipient = {
  address: "0x1111111111111111111111111111111111111111",
  source: "manual",
};

describe("sendFlowReducer", () => {
  it("moves forward and backward through the send steps", () => {
    const amount = sendFlowReducer(initialSendFlowState, {
      type: "select-recipient",
      recipient,
    });
    expect(amount).toMatchObject({ recipient, step: "amount" });

    const review = sendFlowReducer(amount, { type: "advance" });
    expect(review.step).toBe("review");
    expect(sendFlowReducer(review, { type: "back" }).step).toBe("amount");
  });

  it("resets a completed send without retaining sensitive form state", () => {
    const populated = {
      ...initialSendFlowState,
      mode: "send" as const,
      step: "review" as const,
      recipient,
      amountInput: "12.5",
      note: "Thanks",
      showConfirm: true,
    };

    expect(sendFlowReducer(populated, { type: "reset-after-send" })).toEqual(initialSendFlowState);
  });

  it("returns to Balance on tab reset while retaining a resumable draft", () => {
    const populated = {
      ...initialSendFlowState,
      mode: "send" as const,
      step: "amount" as const,
      recipient,
      amountInput: "3",
    };

    expect(sendFlowReducer(populated, { type: "reset-tab" })).toMatchObject({
      mode: "balance",
      step: "recipient",
      recipient,
      amountInput: "3",
      showConfirm: false,
    });
  });
});
