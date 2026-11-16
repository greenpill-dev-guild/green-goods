import { createIntl, createIntlCache } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  recordWorkSubmissionFailure,
  recordWorkSubmissionOutcome,
  recordWorkSubmissionStart,
  showWorkSubmissionFailure,
} from "../../../hooks/work/workSubmissionFeedback";
import { createOfflineTxHash } from "../../../modules/job-queue/queue-policy";
import { WorkSendCancelledError } from "../../../modules/work/send-outcome";
import { UploadPolicyCancelledError } from "../../../modules/work/upload-policy";
import { WorkSubmissionError } from "../../../modules/work/wallet-submission/types";
import { ConnectionNeededError } from "../../../utils/errors/unsent-failures";
import { toastService, walletProgressToasts } from "../../../components/toast";
import { trackContractError } from "../../../modules/app/error-tracking";
import {
  trackWorkSubmissionFailed,
  trackWorkSubmissionOffline,
  trackWorkSubmissionQueued,
  trackWorkSubmissionSuccess,
} from "../../../modules/app/analytics-events";
import { connectivityStore } from "../../../stores/connectivity";

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
  trackWorkSubmissionOffline: vi.fn(),
  trackWorkSubmissionQueued: vi.fn(),
  trackWorkSubmissionStarted: vi.fn(),
  trackWorkSubmissionSuccess: vi.fn(),
  trackWorkWalletRequestExpired: vi.fn(),
  trackWorkWalletRequestFailed: vi.fn(),
}));
// Who the analytics transport names now: a test changes it to stand for an account switch.
const analyticsPerson = vi.hoisted(() => ({ current: "person-a" }));
vi.mock("../../../modules/app/posthog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../modules/app/posthog")>()),
  getDistinctId: () => analyticsPerson.current,
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

// PRD-1495: every Submit ends on record, whoever is still looking at it.
describe("recording a Submit's ending", () => {
  beforeEach(() => vi.clearAllMocks());
  const options = { authMode: "passkey" as const, actionUID: 1 };
  const journey = { journeyId: "test-journey" };

  it("records a failure nobody is watching any more, and shows nothing", () => {
    recordWorkSubmissionFailure(new Error("Unknown send outcome"), options, journey, {
      images: [new File(["x"], "photo.jpg")],
    });
    expect(trackWorkSubmissionFailed).toHaveBeenCalledWith(
      expect.objectContaining({ imageCount: 1, workSubmissionJourneyId: "test-journey" })
    );
    expect(trackContractError).toHaveBeenCalled();
    expect(toastService.error).not.toHaveBeenCalled();
    expect(walletProgressToasts.error).not.toHaveBeenCalled();
  });

  it("never lets a record that fails reach the Submit it records", () => {
    const broken = () => {
      throw new Error("record failed");
    };
    // Each throw is set just before its call, so a failure here cannot leak into the next test.
    vi.mocked(trackWorkSubmissionFailed).mockImplementationOnce(broken);
    const terms = new UploadPolicyCancelledError();
    expect(() =>
      recordWorkSubmissionFailure(terms, options, journey, { images: [] })
    ).not.toThrow();
    vi.mocked(trackWorkSubmissionSuccess).mockImplementationOnce(broken);
    expect(() => recordWorkSubmissionOutcome(journey, "0xsent", options)).not.toThrow();
    expect(trackWorkSubmissionFailed).toHaveBeenCalledOnce();
    expect(trackWorkSubmissionSuccess).toHaveBeenCalledOnce();
  });

  it("records a declined Terms prompt as a Submit the person cancelled, not a failure", () => {
    recordWorkSubmissionFailure(new UploadPolicyCancelledError(), options, journey, { images: [] });
    expect(trackWorkSubmissionFailed).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        error: "UploadPolicyDeclined",
        parsedErrorFamily: "UserRejected",
        submissionPhase: "review",
      })
    );
    expect(trackContractError).not.toHaveBeenCalled();
  });

  it("records a stop before admission, such as a take-up that did not go, apart from a declined Terms prompt", () => {
    const stopped = new UploadPolicyCancelledError("before-admission");
    recordWorkSubmissionFailure(stopped, options, journey, { images: [] });
    expect(trackWorkSubmissionFailed).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        error: "StoppedBeforeAdmission",
        parsedErrorFamily: "StoppedBeforeAdmission",
        submissionPhase: "review",
      })
    );
  });

  it("records a Submit's ending only under the analytics person its start was", () => {
    const sent = {
      kind: "direct",
      txHash: `0x${"ef".repeat(32)}`,
      sponsored: false,
      clientWorkId: "work-2",
    } as const;
    const start = (journeyId: string) =>
      recordWorkSubmissionStart({ authMode: "passkey", workSubmissionJourneyId: journeyId });
    try {
      // The account changed while the Submit was still out: its ending is not recorded at all.
      analyticsPerson.current = "person-a";
      start("switched");
      analyticsPerson.current = "person-b";
      recordWorkSubmissionOutcome({ journeyId: "switched", outcome: sent }, sent.txHash, options);
      recordWorkSubmissionFailure(
        new Error("late"),
        options,
        { journeyId: "switched" },
        { images: [] }
      );
      expect(trackWorkSubmissionSuccess).not.toHaveBeenCalled();
      expect(trackWorkSubmissionFailed).not.toHaveBeenCalled();

      // Same person, or a start made before analytics connected: the ending is recorded.
      start("same");
      recordWorkSubmissionOutcome({ journeyId: "same", outcome: sent }, sent.txHash, options);
      analyticsPerson.current = "not-initialized";
      start("early");
      analyticsPerson.current = "person-b";
      recordWorkSubmissionOutcome({ journeyId: "early", outcome: sent }, sent.txHash, options);
      expect(trackWorkSubmissionSuccess).toHaveBeenCalledTimes(2);
    } finally {
      analyticsPerson.current = "person-a";
    }
  });

  it("records a send whose check has not answered as awaiting confirmation, never as a success", () => {
    const awaiting = {
      kind: "awaiting-confirmation",
      reason: "connection-unconfirmed",
      txHash: `0x${"ab".repeat(32)}`,
      sponsored: true,
      jobId: "job-1",
      clientWorkId: "work-1",
    } as const;
    recordWorkSubmissionOutcome({ ...journey, outcome: awaiting }, awaiting.txHash, options);
    expect(trackWorkSubmissionQueued).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ status: "awaiting-confirmation", reason: "connection-unconfirmed" })
    );
    expect(trackWorkSubmissionSuccess).not.toHaveBeenCalled();
  });

  it("records work saved for later as saved, not as a success, and says why it was not sent", () => {
    const queued = {
      kind: "queued",
      txHash: createOfflineTxHash("job-1"),
      sponsored: false,
      jobId: "job-1",
      clientWorkId: "work-1",
    } as const;
    const online = vi.spyOn(connectivityStore, "getSnapshot");
    try {
      online.mockReturnValue(false);
      recordWorkSubmissionOutcome({ ...journey, outcome: queued }, queued.txHash, options);
      online.mockReturnValue(true);
      recordWorkSubmissionOutcome({ ...journey, outcome: queued }, queued.txHash, options);
      const unconfirmed = { ...queued, reason: "connection-unconfirmed" } as const;
      recordWorkSubmissionOutcome({ ...journey, outcome: unconfirmed }, queued.txHash, options);
    } finally {
      online.mockRestore();
    }
    expect(vi.mocked(trackWorkSubmissionOffline).mock.calls.map(([saved]) => saved.reason)).toEqual(
      ["offline", "not-sent", "connection-unconfirmed"]
    );
    expect(trackWorkSubmissionSuccess).not.toHaveBeenCalled();

    // Only a send that reached the chain is a success.
    const sent = {
      kind: "direct",
      txHash: `0x${"cd".repeat(32)}`,
      sponsored: false,
      clientWorkId: "work-1",
    } as const;
    recordWorkSubmissionOutcome({ ...journey, outcome: sent }, sent.txHash, options);
    expect(trackWorkSubmissionSuccess).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ wasOffline: false, submissionPhase: "success" })
    );
  });
});
