/**
 * ErrorBoundary Tests
 *
 * Verifies that the shared boundary reports component crashes through the
 * centralized error funnel before running optional fallback side effects.
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLoggerError, mockTrackErrorBoundary } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
  mockTrackErrorBoundary: vi.fn(),
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

vi.mock("../../modules/app/error-events", () => ({
  trackErrorBoundary: (...args: unknown[]) => mockTrackErrorBoundary(...args),
}));

import { ErrorBoundary } from "../../components/ErrorBoundary/ErrorBoundary";

function ThrowingChild() {
  throw new Error("Boundary test explosion");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tracks caught component errors through the centralized error funnel", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();

    render(
      <ErrorBoundary context="TestBoundary" onError={onError}>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(mockTrackErrorBoundary).toHaveBeenCalledWith(expect.any(Error), {
      componentStack: expect.any(String),
      boundaryName: "TestBoundary",
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({}));

    consoleSpy.mockRestore();
  });
});
