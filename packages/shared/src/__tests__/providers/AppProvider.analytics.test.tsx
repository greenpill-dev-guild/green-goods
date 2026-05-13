import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "../../providers/App";

const posthogProviderMock = vi.hoisted(() =>
  vi.fn(({ children }: { children: ReactNode }) => <>{children}</>)
);

vi.mock("posthog-js/react", () => ({
  PostHogProvider: posthogProviderMock,
}));

describe("AppProvider PostHog key selection", () => {
  beforeEach(() => {
    posthogProviderMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the default VITE_POSTHOG_KEY fallback by default", () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "client-project-key");

    render(
      <AppProvider>
        <span>content</span>
      </AppProvider>
    );

    expect(screen.getByText("content")).toBeInTheDocument();
    expect(posthogProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "client-project-key",
      }),
      undefined
    );
  });

  it("can disable default fallback so Admin never routes into the App project", () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "client-project-key");

    render(
      <AppProvider allowPosthogKeyFallback={false}>
        <span>admin content</span>
      </AppProvider>
    );

    expect(screen.getByText("admin content")).toBeInTheDocument();
    expect(posthogProviderMock).not.toHaveBeenCalled();
  });
});
