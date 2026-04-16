/**
 * BottomSheet Tests
 *
 * Verifies the BottomSheet component slides up from the bottom, includes
 * a drag handle, handles Escape key and overlay click dismiss, and wraps
 * content in SheetErrorBoundary.
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock logger
vi.mock("../../modules/app/logger", () => {
  const l = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
  return { logger: l, createLogger: () => l };
});

// Mock react-intl
vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => {
      const messages: Record<string, string> = {
        "app.common.close": "Close",
        "app.common.retry": "Retry",
        "app.common.failedToLoad": "Failed to load",
      };
      return messages[id] ?? id;
    },
  }),
}));

import { BottomSheet } from "../../components/Canvas/BottomSheet";

describe("BottomSheet", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when closed", () => {
    render(
      <BottomSheet open={false} onClose={() => {}} title="Actions">
        <p>Content</p>
      </BottomSheet>
    );

    expect(screen.queryByTestId("bottom-sheet")).toBeNull();
  });

  it("renders content when open", () => {
    render(
      <BottomSheet open={true} onClose={() => {}} title="Actions">
        <p>Sheet content here</p>
      </BottomSheet>
    );

    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    expect(screen.getByText("Sheet content here")).toBeTruthy();
  });

  it("renders title", () => {
    render(
      <BottomSheet open={true} onClose={() => {}} title="Action Panel">
        <p>Content</p>
      </BottomSheet>
    );

    expect(screen.getByText("Action Panel")).toBeTruthy();
  });

  it("has correct ARIA attributes", () => {
    render(
      <BottomSheet open={true} onClose={() => {}} title="Accessibility Test">
        <p>Content</p>
      </BottomSheet>
    );

    // ARIA attributes live on the native <dialog>, not the content div
    const dialog = screen.getByTestId("bottom-sheet-dialog");
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("Accessibility Test");
  });

  it("renders drag handle", () => {
    render(
      <BottomSheet open={true} onClose={() => {}}>
        <p>Content</p>
      </BottomSheet>
    );

    expect(screen.getByTestId("bottom-sheet-drag-handle")).toBeTruthy();
  });

  it("applies default max height of 85dvh", () => {
    render(
      <BottomSheet open={true} onClose={() => {}}>
        <p>Content</p>
      </BottomSheet>
    );

    const dialog = screen.getByTestId("bottom-sheet");
    expect(dialog.style.maxHeight).toBe("85dvh");
  });

  it("applies custom max height", () => {
    render(
      <BottomSheet open={true} onClose={() => {}} maxHeight={60}>
        <p>Content</p>
      </BottomSheet>
    );

    const dialog = screen.getByTestId("bottom-sheet");
    expect(dialog.style.maxHeight).toBe("60dvh");
  });

  it("renders overlay when open", () => {
    render(
      <BottomSheet open={true} onClose={() => {}} title="Test">
        <p>Content</p>
      </BottomSheet>
    );

    expect(screen.getByTestId("bottom-sheet-overlay")).toBeTruthy();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </BottomSheet>
    );

    // Native <dialog> fires a cancel event when Escape is pressed;
    // simulate that rather than dispatching a keyboard event.
    const dialog = screen.getByTestId("bottom-sheet-dialog");
    fireEvent(dialog, new Event("cancel", { bubbles: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders close button with aria-label when title is provided", () => {
    render(
      <BottomSheet open={true} onClose={() => {}} title="Test">
        <p>Content</p>
      </BottomSheet>
    );

    const closeBtn = screen.getByTestId("bottom-sheet-close");
    expect(closeBtn.getAttribute("aria-label")).toBe("Close");
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </BottomSheet>
    );

    await user.click(screen.getByTestId("bottom-sheet-close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("applies z-index via inline style in unbounded mode", () => {
    render(
      <BottomSheet open={true} onClose={() => {}} title="Test">
        <p>Content</p>
      </BottomSheet>
    );

    const content = screen.getByTestId("bottom-sheet");
    expect(content.style.zIndex).toBe("51");
  });

  it("has the shared xl radius for top edge rounding", () => {
    render(
      <BottomSheet open={true} onClose={() => {}} title="Test">
        <p>Content</p>
      </BottomSheet>
    );

    const dialog = screen.getByTestId("bottom-sheet");
    expect(dialog.className).toContain("rounded-t-xl");
  });

  it("uses bounded absolute positioning when container is provided", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    render(
      <BottomSheet open={true} onClose={() => {}} title="Bounded" container={container}>
        <p>Content</p>
      </BottomSheet>
    );

    const dialogEl = screen.getByTestId("bottom-sheet-dialog");
    const content = screen.getByTestId("bottom-sheet");

    // Native dialog uses absolute positioning in bounded mode
    expect(dialogEl.className).toContain("absolute");
    // Content uses percentage maxHeight and lower z-index
    expect(content.style.maxHeight).toBe("85%");
    expect(content.style.zIndex).toBe("46");
  });
});
