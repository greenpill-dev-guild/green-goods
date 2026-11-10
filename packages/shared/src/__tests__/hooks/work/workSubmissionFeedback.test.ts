import { createIntl, createIntlCache } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { showWorkSubmissionFailure } from "../../../hooks/work/workSubmissionFeedback";
import { WorkSendCancelledError } from "../../../modules/work/send-outcome";
import { WorkSubmissionError } from "../../../modules/work/wallet-submission/types";
import { ConnectionNeededError } from "../../../utils/errors/unsent-failures";
import { toastService, walletProgressToasts } from "../../../components/toast";
import { trackContractError } from "../../../modules/app/error-tracking";
import { trackWorkSubmissionFailed } from "../../../modules/app/analytics-events";

vi.mock("../../../components/toast", () => ({
  toastService: { info: vi.fn(), error: vi.fn() },
  walletProgressToasts: { dismiss: vi.fn(), error: vi.fn() },
}));
vi.mock("../../../modules/app/error-tracking", () => ({
  trackContractError: vi.fn(),
  trackUploadError: vi.fn(),
}));
vi.mock("../../../modules/app/analytics-events", () => ({
  trackWorkSubmissionFailed: vi.fn(),
  trackWorkWalletRequestExpired: vi.fn(),
  trackWorkWalletRequestFailed: vi.fn(),
}));

const context = {
  allowOfflineQueue: true,
  intl: createIntl(
    {
      locale: "en",
      messages: {
        "app.errors.blockchain.userRejected.message": "The request was declined.",
        "app.work.sendCancelled.title": "Upload cancelled",
        "app.work.sendCancelled.message": "Nothing was sent. Your work is saved in To Uploads.",
        "app.home.work.retryError": "Try again",
        "app.home.work.retryFailedMessage": "Work saved",
        "app.toast.queue.jobFailed.title": "Didn't send",
      },
    },
    createIntlCache()
  ),
  authMode: "passkey" as const,
  actionUID: 1,
  gardenAddress: "0x2222222222222222222222222222222222222222" as const,
  chainId: 42161,
  imageCount: 1,
  workSubmissionJourneyId: "test-journey",
};

describe("showWorkSubmissionFailure", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    "passkey",
    "wallet",
  ] as const)("explains a known %s cancellation without a contract error", (authMode) => {
    showWorkSubmissionFailure(new WorkSendCancelledError(), { ...context, authMode });
    expect(toastService.info).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Upload cancelled",
        message: expect.stringContaining("To Uploads"),
      })
    );
    expect(trackWorkSubmissionFailed).toHaveBeenCalledWith(
      expect.objectContaining({ parsedErrorFamily: "UserRejected" })
    );
    expect(trackContractError).not.toHaveBeenCalled();
    expect(toastService.error).not.toHaveBeenCalled();
    expect(walletProgressToasts.error).not.toHaveBeenCalled();
  });

  it("recognizes a wrapped wallet refusal but not an upload abort", () => {
    const refusal = Object.assign(new Error("Declined"), { code: 4001 });
    showWorkSubmissionFailure(
      new WorkSubmissionError("Wallet stopped", "transaction", undefined, refusal),
      { ...context, authMode: "wallet" }
    );
    expect(toastService.info).toHaveBeenCalledOnce();
    vi.clearAllMocks();
    showWorkSubmissionFailure(
      new WorkSubmissionError(
        "Upload stopped",
        "upload",
        undefined,
        new DOMException("Aborted", "AbortError")
      ),
      context
    );
    expect(toastService.info).not.toHaveBeenCalled();
    expect(toastService.error).toHaveBeenCalled();
  });

  it.each([
    [
      "wallet",
      new WorkSubmissionError(
        "Wallet stopped",
        "transaction",
        undefined,
        Object.assign(new Error("Declined"), { code: 4001 })
      ),
    ],
    ["passkey", new WorkSendCancelledError()],
  ] as const)("does not promise queued recovery for a declined %s send when offline admission is disabled", (authMode, error) => {
    showWorkSubmissionFailure(error, { ...context, authMode, allowOfflineQueue: false });
    expect(toastService.info).toHaveBeenCalledWith(
      expect.objectContaining({ message: "The request was declined." })
    );
  });

  const nothingSent = "Nothing was sent. Check your connection, then try again.";
  it.each([
    ["the refusal of a send without the queue", false, new ConnectionNeededError(), nothingSent],
    ["any offline failure without the queue", false, new Error("You are offline"), nothingSent],
    [
      "an offline failure the queue holds",
      true,
      new Error("You are offline"),
      expect.stringContaining("saved"),
    ],
  ])("says of %s only what a queue holds", (_case, allowOfflineQueue, error, message) => {
    showWorkSubmissionFailure(error, { ...context, allowOfflineQueue });
    expect(toastService.error).toHaveBeenCalledWith(expect.objectContaining({ message }));
  });

  it("never tells a passkey account to reconnect a wallet it does not have", () => {
    const sessionLost = new Error("Wallet session expired");
    showWorkSubmissionFailure(sessionLost, context);
    const [shown] = vi.mocked(toastService.error).mock.calls[0];
    // The failure has the app's one name for it, and its words never mention a wallet.
    expect(shown).toMatchObject({ title: "Didn't send", message: "Try again" });
    expect(`${shown.title} ${shown.message} ${shown.description ?? ""}`).not.toMatch(/wallet/i);

    vi.clearAllMocks();
    showWorkSubmissionFailure(sessionLost, { ...context, authMode: "wallet" });
    // A wallet account still gets the wallet's own advice.
    expect(walletProgressToasts.error).toHaveBeenCalledWith(
      expect.stringContaining("reconnect your wallet"),
      true
    );
  });

  it("keeps an unclassified failure out of the cancellation branch", () => {
    showWorkSubmissionFailure(new Error("Unknown send outcome"), context);
    expect(toastService.info).not.toHaveBeenCalled();
    expect(trackContractError).toHaveBeenCalled();
    expect(toastService.error).toHaveBeenCalled();
  });
});
