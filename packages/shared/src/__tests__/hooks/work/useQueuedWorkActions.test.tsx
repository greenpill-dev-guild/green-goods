/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retryJob: vi.fn(),
  discardJob: vi.fn(),
  schedule: vi.fn(),
  logError: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../modules/job-queue/default-instance", () => ({
  jobQueue: { retryJob: mocks.retryJob, discardJob: mocks.discardJob },
}));
vi.mock("../../../modules/work/upload-preparation", () => ({
  scheduleUploadPreparation: mocks.schedule,
}));
vi.mock("../../../components/toast", () => ({ toastService: mocks.toast }));
vi.mock("../../../modules/app/logger", () => ({
  logger: { error: mocks.logError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

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
  mocks.discardJob.mockResolvedValue(true);
});

describe("useQueuedWorkActions", () => {
  it("tries a work again by clearing what stopped it and waking preparation", async () => {
    const actions = render("job-1");

    await act(() => actions.current.tryAgain());

    expect(mocks.retryJob).toHaveBeenCalledWith("job-1");
    expect(mocks.schedule).toHaveBeenCalledOnce();
    expect(mocks.retryJob.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.schedule.mock.invocationCallOrder[0]
    );
    expect(actions.current.isTryingAgain).toBe(false);
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

  it("discards a work that never reached the chain", async () => {
    const actions = render("job-1");

    let discarded = false;
    await act(async () => {
      discarded = await actions.current.discard();
    });

    expect(discarded).toBe(true);
    expect(mocks.discardJob).toHaveBeenCalledWith("job-1");
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
