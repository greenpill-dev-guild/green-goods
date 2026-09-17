import messages from "@green-goods/shared/i18n/en.json";
import type { Work } from "@green-goods/shared/types/domain";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    onRetry: vi.fn(),
    isRetrying: false,
    onOpenUploads: vi.fn(),
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

  it("points waiting work to Your Work, where Upload all sends it", () => {
    const props = renderFooter(queuedWork("ready"));

    expect(screen.getByTestId("work-upload-footer")).toHaveTextContent(
      "Saved on your device. Upload it from Your Work."
    );
    fireEvent.click(screen.getByRole("button", { name: "Open uploads" }));
    expect(props.onOpenUploads).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Send Now" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
  });

  it("says what preparing work waits for", () => {
    renderFooter(queuedWork("photo-pending"));

    expect(screen.getByTestId("work-upload-footer")).toHaveTextContent(
      "A photo is still converting"
    );
    expect(screen.getByRole("button", { name: "Open uploads" })).toBeEnabled();
  });

  it("keeps Open uploads while offline and says the work waits on this device", () => {
    renderFooter(queuedWork("ready"), { isOnline: false });

    expect(screen.getByRole("button", { name: "Open uploads" })).toBeEnabled();
    expect(
      screen.getByText("You're offline. Upload it from Your Work once you're connected.")
    ).toBeInTheDocument();
  });

  it("explains a refusal and offers to try again or discard", async () => {
    const props = renderFooter(queuedWork("blocked", "NotActiveAction"));

    expect(screen.getByTestId("work-upload-footer")).toHaveTextContent(
      "Can't upload: this action has ended"
    );
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

  it("keeps Send Now for work whose send failed, and lets unsent work be discarded", () => {
    const props = renderFooter(queuedWork("retry-required"));

    fireEvent.click(screen.getByRole("button", { name: "Send Now" }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open uploads" })).not.toBeInTheDocument();
  });

  it("never offers to discard a reverted send, which left a transaction behind", () => {
    renderFooter(queuedWork("reverted"));

    expect(screen.getByRole("button", { name: "Send Now" })).toBeInTheDocument();
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
    expect(screen.getByTestId("work-upload-footer")).toHaveTextContent(
      "We’re checking whether this work was sent."
    );
  });
});
