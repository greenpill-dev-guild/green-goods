/**
 * ErrorBoundary Component Tests
 *
 * Tests for the GardenErrorBoundary component.
 * Note: Testing error boundaries in Vitest/jsdom has limitations.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock react-intl
vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ defaultMessage }: { defaultMessage: string }) => defaultMessage,
  }),
}));

// Mock Button component from relative path
vi.mock("../../components/Actions", () => ({
  Button: ({ label, onClick }: any) => createElement("button", { onClick, type: "button" }, label),
}));

// Mock shared barrel to avoid WalletConnect/shared dependency chain resolution
vi.mock("@green-goods/shared", () => ({
  trackErrorBoundary: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GardenErrorBoundary } from "../../components/Errors/ErrorBoundary";

// Component that throws
const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return createElement("div", null, "Normal content");
};

describe("GardenErrorBoundary", () => {
  // Suppress console.error for error boundary tests
  const originalError = console.error;
  let errorHandler: (e: ErrorEvent) => void;

  beforeEach(() => {
    console.error = vi.fn();
    // Suppress uncaught errors from error boundary tests
    // This prevents Vitest from catching intentional throws as unhandled exceptions
    // Must use capture phase and stopImmediatePropagation to prevent jsdom from re-throwing
    errorHandler = (e: ErrorEvent) => {
      if (e.message === "Test error") {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("error", errorHandler, true);
  });

  afterEach(() => {
    cleanup();
    console.error = originalError;
    window.removeEventListener("error", errorHandler, true);
  });

  describe("normal rendering", () => {
    it("renders children when no error occurs", () => {
      render(createElement(GardenErrorBoundary, null, createElement("div", null, "Child content")));

      expect(screen.getByText("Child content")).toBeInTheDocument();
    });

    it("renders multiple children", () => {
      render(
        createElement(
          GardenErrorBoundary,
          null,
          createElement("div", null, "First child"),
          createElement("div", null, "Second child")
        )
      );

      expect(screen.getByText("First child")).toBeInTheDocument();
      expect(screen.getByText("Second child")).toBeInTheDocument();
    });
  });

  describe("custom fallback", () => {
    it("renders custom fallback when provided and error occurs", () => {
      const customFallback = createElement("div", null, "Custom error fallback");

      // Render with a component that will throw
      render(
        createElement(
          GardenErrorBoundary,
          { fallback: customFallback },
          createElement(ThrowingComponent, { shouldThrow: true })
        )
      );

      expect(screen.getByText("Custom error fallback")).toBeInTheDocument();
    });

    it("does not render fallback when no error", () => {
      const customFallback = createElement("div", null, "Custom error fallback");

      render(
        createElement(
          GardenErrorBoundary,
          { fallback: customFallback },
          createElement("div", null, "Normal content")
        )
      );

      expect(screen.getByText("Normal content")).toBeInTheDocument();
      expect(screen.queryByText("Custom error fallback")).not.toBeInTheDocument();
    });
  });

  describe("default error UI", () => {
    it("shows default error UI when error occurs without custom fallback", () => {
      render(
        createElement(
          GardenErrorBoundary,
          null,
          createElement(ThrowingComponent, { shouldThrow: true })
        )
      );

      expect(screen.getByText("Garden failed to load")).toBeInTheDocument();
      expect(
        screen.getByText("Something went wrong while loading this garden. Please try again.")
      ).toBeInTheDocument();
    });

    it("shows try again and go back buttons in error state", () => {
      render(
        createElement(
          GardenErrorBoundary,
          null,
          createElement(ThrowingComponent, { shouldThrow: true })
        )
      );

      expect(screen.getByText("Try Again")).toBeInTheDocument();
      expect(screen.getByText("Go Back")).toBeInTheDocument();
    });

    it("shows technical details section", () => {
      render(
        createElement(
          GardenErrorBoundary,
          null,
          createElement(ThrowingComponent, { shouldThrow: true })
        )
      );

      expect(screen.getByText("Technical details")).toBeInTheDocument();
    });
  });
});
