import messages from "@green-goods/shared/i18n/en.json";
import type { Work } from "@green-goods/shared/types/domain";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkUploadFooter, type WorkUploadFooterProps } from "@/views/Home/Garden/WorkUploadFooter";

function queuedWork(submissionState: string, blockedReason?: string): Work {
  return {
    id: "job-1",
    title: "Planting Event",
    actionUID: 1,
    gardenerAddress: "0x1111111111111111111111111111111111111111",
    gardenAddress: "0x2222222222222222222222222222222222222222",
    feedback: "",
    metadata: JSON.stringify({ submissionState, blockedReason }),
    media: [],
    createdAt: 1_700_000_000,
    status: "offline",
  };
}

function renderFooter(work: Work, overrides: Partial<WorkUploadFooterProps> = {}) {
  const props: WorkUploadFooterProps = {
    work,
    isOnline: true,
    pausedForDataSaver: false,
    onPrepareNow: vi.fn(),
    onRetry: vi.fn(),
    isRetrying: false,
    onTryAgain: vi.fn(),
    isTryingAgain: false,
    onDiscard: vi.fn(async () => undefined),
    isDiscarding: false,
    ...overrides,
  };
  render(
    <IntlProvider locale="en" messages={messages}>
      <WorkUploadFooter {...props} />
    </IntlProvider>
  );
  return props;
}

describe("WorkUploadFooter", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Phone width, where the discard confirmation is a bottom sheet.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query.includes("max-width: 639px"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it("offers Upload now for waiting work", () => {
    const props = renderFooter(queuedWork("ready"));

    fireEvent.click(screen.getByRole("button", { name: "Upload now" }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
  });

  it("carries only the actions: the header above says where the work stands", () => {
    // One sentence, once. A footer that restated it could also contradict it, as
    // it did when the header still said to upload work the chain would refuse.
    for (const work of [
      queuedWork("photo-pending"),
      queuedWork("blocked", "NotActiveAction"),
      queuedWork("awaiting-confirmation"),
    ]) {
      renderFooter(work);
      expect(screen.getByTestId("work-upload-footer").querySelector("p")).toBeNull();
      cleanup();
    }
  });

  it("disables Upload now while offline and explains when to use it", () => {
    renderFooter(queuedWork("ready"), { isOnline: false });

    expect(screen.getByRole("button", { name: "Upload now" })).toBeDisabled();
    expect(
      screen.getByText("You're offline. Upload this work once you're connected.")
    ).toBeInTheDocument();
  });

  it("does not offer signing while a photo is still preparing", () => {
    renderFooter(queuedWork("photo-pending"));

    expect(screen.getByRole("button", { name: "Preparing uploads…" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.queryByRole("button", { name: "Upload now" })).not.toBeInTheDocument();
  });

  it("lets the person start photo preparation under Data Saver", () => {
    const props = renderFooter(queuedWork("photo-pending"), { pausedForDataSaver: true });

    fireEvent.click(screen.getByRole("button", { name: "Prepare now" }));
    expect(props.onPrepareNow).toHaveBeenCalledOnce();
  });

  it("offers to try refused work again or discard it", async () => {
    const props = renderFooter(queuedWork("blocked", "NotActiveAction"));

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(props.onTryAgain).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(props.onDiscard).not.toHaveBeenCalled();
    expect(await screen.findByText("Discard this work?")).toBeInTheDocument();
    const confirm = screen
      .getAllByRole("button", { name: "Discard" })
      .find((button) => button.closest("[data-testid='confirm-dialog']"));
    expect(confirm).toBeDefined();
    fireEvent.click(confirm as HTMLElement);
    await waitFor(() => expect(props.onDiscard).toHaveBeenCalledOnce());
  });

  it("keeps Upload now for work whose upload failed, and lets unsent work be discarded", () => {
    const props = renderFooter(queuedWork("retry-required"));

    fireEvent.click(screen.getByRole("button", { name: "Upload now" }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open uploads" })).not.toBeInTheDocument();
  });

  it("never offers to discard a reverted send, which left a transaction behind", () => {
    renderFooter(queuedWork("reverted"));

    expect(screen.getByRole("button", { name: "Upload now" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
  });

  it("checks a sent work again instead of sending it, and only while online", () => {
    const props = renderFooter(queuedWork("awaiting-confirmation"));

    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open uploads" })).not.toBeInTheDocument();
  });

  it("disables checking a sent work while offline", () => {
    renderFooter(queuedWork("checking-submission"), { isOnline: false });

    expect(screen.getByRole("button", { name: "Check again" })).toBeDisabled();
  });
});
