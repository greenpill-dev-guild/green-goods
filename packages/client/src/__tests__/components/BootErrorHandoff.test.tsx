/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  routeError: new Error("Route boot failed"),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useRouteError: () => mocks.routeError,
}));

vi.mock("../../components/Actions", () => ({
  Button: ({ label, onClick }: { label: string; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
}));

vi.mock("@green-goods/shared/components/Alert", () => ({
  Alert: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@green-goods/shared/modules/app/error-events", () => ({
  trackErrorBoundary: vi.fn(),
}));

vi.mock("@green-goods/shared/modules/app/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { AppErrorBoundary } from "../../components/Errors/AppErrorBoundary";
import { RouteErrorBoundary } from "../../components/Errors/RouteErrorBoundary";

function ThrowDuringBoot(): never {
  throw new Error("App boot failed");
}

describe("boot error fallback handoff", () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
    window.__GG_MARK_BOOT_FAILED = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    delete window.__GG_MARK_BOOT_FAILED;
  });

  it("reveals the app error boundary when startup rendering fails", () => {
    render(
      <AppErrorBoundary>
        <ThrowDuringBoot />
      </AppErrorBoundary>
    );

    expect(window.__GG_MARK_BOOT_FAILED).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("reveals the route error boundary when a lazy route fails", async () => {
    render(<RouteErrorBoundary />);

    await waitFor(() => {
      expect(window.__GG_MARK_BOOT_FAILED).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});

declare global {
  interface Window {
    __GG_MARK_BOOT_FAILED?: () => void;
  }
}
