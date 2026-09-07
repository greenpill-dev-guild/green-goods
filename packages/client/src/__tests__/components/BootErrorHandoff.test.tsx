/**
 * @vitest-environment jsdom
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  routeError: new Error("Route boot failed"),
}));

const FAILED_APP_SHELL_IMPORT = new TypeError(
  "Failed to fetch dynamically imported module: https://localhost:3001/src/routes/AppShell.tsx"
);

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

vi.mock("@green-goods/shared/hooks/analytics/usePageView", () => ({
  usePageView: vi.fn(),
}));

vi.mock("@green-goods/shared/components/Toast/ToastViewport", () => ({
  ToastViewport: () => null,
}));

import { AppErrorBoundary } from "../../components/Errors/AppErrorBoundary";
import { RouteErrorBoundary } from "../../components/Errors/RouteErrorBoundary";
import {
  hasChunkReloadAttempt,
  markChunkReloadAttempt,
} from "../../components/Errors/errorClassification";
import Root from "../../routes/Root";

function ThrowDuringBoot(): never {
  throw new Error("App boot failed");
}

function ThrowFailedAppShellImport(): never {
  throw FAILED_APP_SHELL_IMPORT;
}

describe("boot error fallback handoff", () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mocks.routeError = new Error("Route boot failed");
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    window.__GG_MARK_BOOT_FAILED = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    console.error = originalConsoleError;
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
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

  it("shows an accurate offline state and reloads once when the AppShell import can retry", async () => {
    mocks.routeError = FAILED_APP_SHELL_IMPORT;
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    render(<RouteErrorBoundary />);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Garden Offline");
    expect(window.location.reload).not.toHaveBeenCalled();
    screen.getByRole("button", { name: "Try Again" }).click();
    expect(window.location.reload).not.toHaveBeenCalled();
    expect(hasChunkReloadAttempt()).toBe(false);

    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("online"));

    expect(window.location.reload).toHaveBeenCalledTimes(1);
    expect(window.addEventListener).toHaveBeenCalledWith("online", expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith("online", expect.any(Function));
  });

  it("recovers an AppErrorBoundary chunk failure through the same reconnect path", async () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    render(
      <AppErrorBoundary>
        <ThrowFailedAppShellImport />
      </AppErrorBoundary>
    );

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Garden Offline");

    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("online"));

    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("does not relabel a non-connectivity offline-category failure as connection loss", async () => {
    mocks.routeError = new Error("IndexedDB unavailable during sync");
    render(<RouteErrorBoundary />);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Garden Maintenance"
    );
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("keeps a usable fallback when the reconnect reload hits another chunk failure", () => {
    mocks.routeError = FAILED_APP_SHELL_IMPORT;
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    const firstLoad = render(<RouteErrorBoundary />);

    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
    expect(window.location.reload).toHaveBeenCalledTimes(1);
    expect(hasChunkReloadAttempt()).toBe(true);

    firstLoad.unmount();
    vi.clearAllMocks();
    render(<RouteErrorBoundary />);

    expect(window.location.reload).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Oops!");
    expect(screen.getByRole("button", { name: "Try Again" })).toBeEnabled();
  });

  it("preserves the one-shot stale-build reload while online", async () => {
    vi.useFakeTimers();
    mocks.routeError = FAILED_APP_SHELL_IMPORT;
    render(<RouteErrorBoundary />);

    await act(() => vi.advanceTimersByTimeAsync(50));

    expect(window.location.reload).toHaveBeenCalledTimes(1);
    expect(hasChunkReloadAttempt()).toBe(true);
  });

  it("clears the one-shot only after a normal route root commits", () => {
    markChunkReloadAttempt();

    render(
      <MemoryRouter>
        <Root />
      </MemoryRouter>
    );

    expect(hasChunkReloadAttempt()).toBe(false);
  });
});

declare global {
  interface Window {
    __GG_MARK_BOOT_FAILED?: () => void;
  }
}
