import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "../../providers/App";

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
}));

vi.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../components/toast", () => ({
  toastService: {
    success: toastMocks.success,
  },
}));

vi.mock("../../modules/app/posthog", () => ({
  registerGlobalProperties: vi.fn(() => true),
  track: vi.fn(),
}));

describe("AppProvider install confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shows a localized success toast only when appinstalled fires", () => {
    localStorage.setItem("gg-language", "es");

    render(
      <AppProvider allowPosthogKeyFallback={false}>
        <span>content</span>
      </AppProvider>
    );

    expect(screen.getByText("content")).toBeInTheDocument();
    expect(toastMocks.success).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(toastMocks.success).toHaveBeenCalledTimes(1);
    expect(toastMocks.success).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "App instalada",
        message: "Green Goods está lista desde tu pantalla de inicio.",
        context: "pwa install",
      })
    );
  });
});
