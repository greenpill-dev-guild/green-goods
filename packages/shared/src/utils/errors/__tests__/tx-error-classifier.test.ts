import { describe, expect, it } from "vitest";
import { classifyTxError, isCancelledTxError } from "../tx-error-classifier";

describe("tx-error-classifier", () => {
  it("classifies wallet rejection message as cancelled warning", () => {
    const result = classifyTxError(new Error("User rejected the request."));
    expect(result.kind).toBe("cancelled");
    expect(result.severity).toBe("warning");
    expect(result.titleKey).toBe("app.txFeedback.cancelled.title");
    expect(result.messageKey).toBe("app.errors.blockchain.userRejected.message");
  });

  it("classifies EIP-1193 rejection code as cancelled warning", () => {
    const result = classifyTxError({ code: 4001, message: "Request rejected" });
    expect(result.kind).toBe("cancelled");
    expect(isCancelledTxError({ code: 4001 })).toBe(true);
  });

  it("classifies insufficient funds as reverted", () => {
    const result = classifyTxError("insufficient funds for intrinsic transaction cost");
    expect(result.kind).toBe("reverted");
    expect(result.messageKey).toBe("app.errors.blockchain.insufficientFunds.message");
  });

  it("classifies execution revert as reverted", () => {
    const result = classifyTxError("execution reverted: NotGardenOperator");
    expect(result.kind).toBe("reverted");
    expect(result.messageKey).toBe("app.errors.blockchain.gasEstimation.message");
  });

  it("classifies timeout as network", () => {
    const result = classifyTxError("request timed out while waiting for transaction");
    expect(result.kind).toBe("network");
    expect(result.messageKey).toBe("app.errors.blockchain.timeout.message");
  });

  it("classifies nonce issues as rpc", () => {
    const result = classifyTxError("nonce too low");
    expect(result.kind).toBe("rpc");
    expect(result.messageKey).toBe("app.errors.blockchain.nonce.message");
  });

  it("falls back to unknown for non-matching errors", () => {
    const result = classifyTxError("unexpected failure");
    expect(result.kind).toBe("unknown");
    expect(result.severity).toBe("error");
    expect(result.titleKey).toBe("app.txFeedback.failed.title");
    expect(result.messageKey).toBe("app.errors.blockchain.unknown.message");
  });
});
