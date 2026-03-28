/**
 * SheetErrorBoundary Tests
 *
 * Verifies that errors in sheet content are caught and displayed as a compact
 * error card with retry and close buttons, and that errors never propagate
 * to the parent.
 *
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock logger
const { mockLoggerError } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
}));
vi.mock("../../modules/app/logger", () => {
  const l = {
    error: (...args: unknown[]) => mockLoggerError(...args),
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
        "app.common.retry": "Retry",
        "app.common.close": "Close",
        "app.common.failedToLoad": "Failed to load",
      };
      return messages[id] ?? id;
    },
  }),
}));

import { SheetErrorBoundary } from "../../components/Cockpit/SheetErrorBoundary";

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test explosion");
  return <div data-testid="child-content">Content loaded</div>;
}

describe("SheetErrorBoundary", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders children when no error occurs", () => {
    render(
      <SheetErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </SheetErrorBoundary>
    );

    expect(screen.getByTestId("child-content")).toBeTruthy();
    expect(screen.getByText("Content loaded")).toBeTruthy();
  });

  it("renders compact error card when child throws", () => {
    // Suppress React's console.error for error boundaries in tests
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <SheetErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </SheetErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Failed to load")).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();

    consoleSpy.mockRestore();
  });

  it("logs the error via logger", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <SheetErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </SheetErrorBoundary>
    );

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining("SheetErrorBoundary"),
      expect.objectContaining({
        message: "Test explosion",
      })
    );

    consoleSpy.mockRestore();
  });

  it("shows close button when onClose is provided", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <SheetErrorBoundary onClose={() => {}}>
        <ThrowingChild shouldThrow={true} />
      </SheetErrorBoundary>
    );

    expect(screen.getByText("Close")).toBeTruthy();

    consoleSpy.mockRestore();
  });

  it("does not show close button when onClose is not provided", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <SheetErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </SheetErrorBoundary>
    );

    expect(screen.queryByText("Close")).toBeNull();

    consoleSpy.mockRestore();
  });

  it("calls onClose when close button is clicked", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onClose = vi.fn();

    render(
      <SheetErrorBoundary onClose={onClose}>
        <ThrowingChild shouldThrow={true} />
      </SheetErrorBoundary>
    );

    await user.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();

    consoleSpy.mockRestore();
  });

  it("retries rendering children on retry click", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Use a flag instead of a counter to be resilient to React dev-mode
    // double-invocation of function components
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) throw new Error("First render fails");
      return <div data-testid="recovered">Recovered</div>;
    }

    render(
      <SheetErrorBoundary>
        <ConditionalThrower />
      </SheetErrorBoundary>
    );

    // Should show error initially
    expect(screen.getByRole("alert")).toBeTruthy();

    // Flip the flag so next render succeeds
    shouldThrow = false;

    // Click retry
    await user.click(screen.getByText("Retry"));

    // Should now show recovered content
    expect(screen.getByTestId("recovered")).toBeTruthy();
    expect(screen.getByText("Recovered")).toBeTruthy();

    consoleSpy.mockRestore();
  });
});
