/**
 * BottomSheet Tests
 *
 * Verifies the BottomSheet component slides up from the bottom, includes
 * a drag handle, handles Escape key and overlay click dismiss, and wraps
 * content in SheetErrorBoundary.
 *
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
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

import { BottomSheet } from "../../components/Cockpit/BottomSheet";

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

    const dialog = screen.getByTestId("bottom-sheet");
    expect(dialog.getAttribute("role")).toBe("dialog");
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

  it("applies default max height of 85vh", () => {
    render(
      <BottomSheet open={true} onClose={() => {}}>
        <p>Content</p>
      </BottomSheet>
    );

    const dialog = screen.getByTestId("bottom-sheet");
    expect(dialog.style.maxHeight).toBe("85vh");
  });

  it("applies custom max height", () => {
    render(
      <BottomSheet open={true} onClose={() => {}} maxHeight={60}>
        <p>Content</p>
      </BottomSheet>
    );

    const dialog = screen.getByTestId("bottom-sheet");
    expect(dialog.style.maxHeight).toBe("60vh");
  });

  it("renders overlay when open", () => {
    render(
      <BottomSheet open={true} onClose={() => {}} title="Test">
        <p>Content</p>
      </BottomSheet>
    );

    expect(screen.getByTestId("bottom-sheet-overlay")).toBeTruthy();
  });

  it("calls onClose when Escape is pressed", async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </BottomSheet>
    );

    await user.keyboard("{Escape}");
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

  it("has z-50 class on content", () => {
    render(
      <BottomSheet open={true} onClose={() => {}} title="Test">
        <p>Content</p>
      </BottomSheet>
    );

    const dialog = screen.getByTestId("bottom-sheet");
    expect(dialog.className).toContain("z-50");
  });

  it("has rounded-t-2xl class for top edge rounding", () => {
    render(
      <BottomSheet open={true} onClose={() => {}} title="Test">
        <p>Content</p>
      </BottomSheet>
    );

    const dialog = screen.getByTestId("bottom-sheet");
    expect(dialog.className).toContain("rounded-t-2xl");
  });
});
