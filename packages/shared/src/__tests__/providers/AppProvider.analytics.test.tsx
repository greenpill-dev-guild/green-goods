import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "../../providers/App";

const initializePostHogMock = vi.hoisted(() => vi.fn());

vi.mock("../../modules/app/posthog-browser", () => ({
  initializePostHog: initializePostHogMock,
}));

describe("AppProvider PostHog key selection", () => {
  beforeEach(() => {
    initializePostHogMock.mockClear();
    Object.defineProperty(document, "readyState", { configurable: true, value: "complete" });
    window.requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(window, "requestIdleCallback");
  });

  it("loads the browser transport after idle with the default key", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "client-project-key");

    render(
      <AppProvider>
        <span>content</span>
      </AppProvider>
    );

    expect(screen.getByText("content")).toBeInTheDocument();
    await waitFor(() => expect(initializePostHogMock).toHaveBeenCalledWith("client-project-key"));
  });

  it("can disable default fallback so Admin never routes into the App project", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "client-project-key");

    render(
      <AppProvider allowPosthogKeyFallback={false}>
        <span>admin content</span>
      </AppProvider>
    );

    expect(screen.getByText("admin content")).toBeInTheDocument();
    await Promise.resolve();
    expect(initializePostHogMock).not.toHaveBeenCalled();
  });
});
