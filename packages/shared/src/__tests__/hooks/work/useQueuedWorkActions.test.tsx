/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retryJob: vi.fn(),
  discardJob: vi.fn(),
  schedule: vi.fn(),
  logError: vi.fn(),
  removeDraft: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  getJob: vi.fn(),
  request: vi.fn(),
  acquire: vi.fn(),
  save: vi.fn(),
  release: vi.fn(),
}));

vi.mock("../../../modules/job-queue/default-instance", () => ({
  jobQueue: { retryJob: mocks.retryJob, discardJob: mocks.discardJob },
}));
vi.mock("../../../modules/work/draft-lifecycle", () => ({
  deleteDraftOfQueuedWork: mocks.removeDraft,
}));
vi.mock("../../../modules/work/upload-preparation", () => ({
  retryUploadPreparationNow: mocks.schedule,
}));
vi.mock("../../../components/toast", () => ({ toastService: mocks.toast }));
vi.mock("../../../modules/app/logger", () => ({
  logger: { error: mocks.logError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => "0x1111111111111111111111111111111111111111",
}));
vi.mock("../../../hooks/work/useUploadPolicy", () => ({
  useUploadPolicy: () => ({ request: mocks.request, prompt: null }),
}));
vi.mock("../../../modules/job-queue/db", () => ({ jobQueueDB: { getJob: mocks.getJob } }));
vi.mock("../../../modules/job-queue/work-claims", () => ({
  acquireAvailableWorkJobs: mocks.acquire,
  saveUnderClaim: mocks.save,
}));
import { queuedWorkJob } from "../../test-utils/queued-jobs";
import { uploadConsent } from "../../test-utils/upload-policy";
import { UploadPolicyCancelledError } from "../../../modules/work/upload-policy";
import { useQueuedWorkActions } from "../../../hooks/work/useQueuedWorkActions";
import en from "../../../i18n/en.json";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(IntlProvider, { locale: "en", messages: en }, children);
}

const render = (workId: string | undefined) =>
  renderHook(() => useQueuedWorkActions(workId), { wrapper }).result;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.retryJob.mockResolvedValue(undefined);
  mocks.getJob.mockResolvedValue(queuedWorkJob());
  mocks.request.mockResolvedValue(uploadConsent());
  mocks.acquire.mockResolvedValue(new Map([["job-1", { token: "claim", release: mocks.release }]]));
  mocks.save.mockImplementation(async (_claim, _id, amend) => amend(await mocks.getJob()));
  mocks.discardJob.mockResolvedValue(true);
});

describe("useQueuedWorkActions", () => {
  it("tries a work again by clearing what stopped it and preparing it at once", async () => {
    const actions = render("job-1");

    await act(() => actions.current.tryAgain());

    expect(mocks.retryJob).toHaveBeenCalledWith("job-1");
    // Preparation forgets this work's backoff, so a try that failed is made again now.
    expect(mocks.schedule).toHaveBeenCalledWith("job-1");
    expect(mocks.retryJob.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.schedule.mock.invocationCallOrder[0]
    );
    // Its Terms are accepted and nothing says otherwise, so they are not asked again.
    expect(mocks.request).not.toHaveBeenCalled();
    expect(actions.current.isTryingAgain).toBe(false);
  });

  it("shows the Terms for a work blocked on them, even with consent on record, before retrying", async () => {
    // PRD-1488: the page asked for the Terms, and Try Again went straight to preparing.
    for (const meta of [
      { waitingReason: "upload-policy-required", waitingForDependency: true },
      {
        preparation: { status: "blocked", reason: "upload-policy-required", checkedAt: "earlier" },
      },
    ]) {
      vi.clearAllMocks();
      const job = queuedWorkJob({ meta });
      mocks.getJob.mockResolvedValue(job);
      const accepted = uploadConsent();
      mocks.request.mockResolvedValue(accepted);
      const actions = render("job-1");

      await act(() => actions.current.tryAgain());

      expect(mocks.request).toHaveBeenCalledOnce();
      expect(mocks.request.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.retryJob.mock.invocationCallOrder[0]
      );
      expect(job.payload.uploadConsent).toBe(accepted);
      expect(job.meta).not.toHaveProperty("waitingReason");
      expect(job.meta).not.toHaveProperty("preparation");
      expect(mocks.retryJob).toHaveBeenCalledWith("job-1");
    }
  });

  it("requires consent for a legacy draft before claiming it or retrying", async () => {
    const job = queuedWorkJob({
      payload: { uploadConsent: undefined },
      meta: { waitingReason: "upload-policy-required", waitingForDependency: true },
    });
    mocks.getJob.mockResolvedValue(job);
    let accept!: (value: ReturnType<typeof uploadConsent>) => void;
    mocks.request.mockReturnValue(
      new Promise((resolve) => {
        accept = resolve;
      })
    );
    const actions = render("job-1");
    let pending!: Promise<void>;
    await act(async () => {
      pending = actions.current.tryAgain();
      await Promise.resolve();
    });
    expect(mocks.request).toHaveBeenCalledOnce();
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.retryJob).not.toHaveBeenCalled();
    await act(async () => {
      accept(uploadConsent());
      await pending;
    });
    expect(job.payload.uploadConsent).toEqual(uploadConsent());
    expect(job.meta?.waitingReason).toBeUndefined();
    expect(job.meta?.waitingForDependency).toBe(false);
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.retryJob).toHaveBeenCalledOnce();
  });

  it("does not retry a different work after navigation while consent waits", async () => {
    mocks.getJob.mockResolvedValue(queuedWorkJob({ payload: { uploadConsent: undefined } }));
    let accept!: (value: ReturnType<typeof uploadConsent>) => void;
    mocks.request.mockReturnValue(
      new Promise((resolve) => {
        accept = resolve;
      })
    );
    const { result, rerender } = renderHook(({ id }) => useQueuedWorkActions(id), {
      initialProps: { id: "job-1" },
      wrapper,
    });
    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.tryAgain();
      await Promise.resolve();
    });
    rerender({ id: "job-2" });
    await act(async () => {
      accept(uploadConsent());
      await pending;
    });
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.retryJob).not.toHaveBeenCalled();
  });
  it("leaves a canceled legacy draft untouched", async () => {
    mocks.getJob.mockResolvedValue(queuedWorkJob({ payload: { uploadConsent: undefined } }));
    mocks.request.mockRejectedValue(new UploadPolicyCancelledError());
    const actions = render("job-1");
    await act(() => actions.current.tryAgain());
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.retryJob).not.toHaveBeenCalled();
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });
  it("preserves a send another tab recorded while consent was open", async () => {
    const job = queuedWorkJob({ payload: { uploadConsent: undefined } });
    mocks.getJob.mockResolvedValue(job);
    mocks.request.mockImplementation(async () => {
      job.payload.uploadCheckpoint = { submittedAt: "now", files: {}, transactionHash: "0x123" };
      return uploadConsent();
    });
    const actions = render("job-1");
    await act(() => actions.current.tryAgain());
    expect(job.payload.uploadConsent).toBeUndefined();
    expect(job.payload.uploadCheckpoint?.transactionHash).toBe("0x123");
    expect(mocks.retryJob).toHaveBeenCalledOnce();
  });
  it("renews missing consent on the first retry after a confirmed revert", async () => {
    const job = queuedWorkJob({
      payload: {
        uploadConsent: undefined,
        uploadCheckpoint: {
          submittedAt: "now",
          files: {},
          transactionHash: "0x123",
          transactionReverted: true,
        },
      },
    });
    mocks.getJob.mockResolvedValue(job);
    const actions = render("job-1");

    await act(() => actions.current.tryAgain());

    expect(job.payload.uploadConsent).toEqual(uploadConsent());
    expect(mocks.request).toHaveBeenCalledOnce();
    expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.retryJob.mock.invocationCallOrder[0]
    );
    expect(mocks.retryJob).toHaveBeenCalledOnce();
  });
  it("reconciles an already recorded send without new consent", async () => {
    mocks.getJob.mockResolvedValue(
      queuedWorkJob({
        payload: {
          uploadConsent: undefined,
          uploadCheckpoint: { submittedAt: "now", files: {}, transactionHash: "0x123" },
        },
      })
    );
    const actions = render("job-1");
    await act(() => actions.current.tryAgain());
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.retryJob).toHaveBeenCalledOnce();
  });
  it("says so when trying again fails, and keeps the work", async () => {
    const failure = new Error("storage unavailable");
    mocks.retryJob.mockRejectedValue(failure);
    const actions = render("job-1");

    await act(() => actions.current.tryAgain());

    expect(mocks.schedule).not.toHaveBeenCalled();
    expect(mocks.logError).toHaveBeenCalledOnce();
    expect(mocks.toast.error).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't try again", error: failure })
    );
    expect(mocks.discardJob).not.toHaveBeenCalled();
    expect(actions.current.isTryingAgain).toBe(false);
  });

  it("discards a work that never reached the chain, with the draft it left in the composer", async () => {
    const job = { id: "job-1", kind: "work" };
    // The queue runs the step it is handed once it knows the work may go, before removing it.
    mocks.discardJob.mockImplementation(
      async (_id: string, beforeDelete: (work: typeof job) => Promise<void>) => {
        await beforeDelete(job);
        expect(mocks.toast.success).not.toHaveBeenCalled();
        return true;
      }
    );
    const actions = render("job-1");

    let discarded = false;
    await act(async () => {
      discarded = await actions.current.discard();
    });

    expect(discarded).toBe(true);
    expect(mocks.discardJob).toHaveBeenCalledWith("job-1", expect.any(Function));
    expect(mocks.removeDraft).toHaveBeenCalledExactlyOnceWith(job, "discard");
    expect(mocks.toast.success).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Work discarded" })
    );
  });

  it("reports a refused discard instead of pretending it worked", async () => {
    mocks.discardJob.mockResolvedValue(false);
    const actions = render("job-1");

    let discarded = true;
    await act(async () => {
      discarded = await actions.current.discard();
    });

    expect(discarded).toBe(false);
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't discard this work" })
    );
  });

  it("reports a discard that throws", async () => {
    const failure = new Error("storage unavailable");
    mocks.discardJob.mockRejectedValue(failure);
    const actions = render("job-1");

    let discarded = true;
    await act(async () => {
      discarded = await actions.current.discard();
    });

    expect(discarded).toBe(false);
    expect(mocks.logError).toHaveBeenCalledOnce();
    expect(mocks.toast.error).toHaveBeenCalledWith(expect.objectContaining({ error: failure }));
    expect(actions.current.isDiscarding).toBe(false);
  });

  it("does nothing without a work", async () => {
    const actions = render(undefined);

    await act(() => actions.current.tryAgain());
    await act(async () => {
      await actions.current.discard();
    });

    expect(mocks.retryJob).not.toHaveBeenCalled();
    expect(mocks.discardJob).not.toHaveBeenCalled();
  });
});
