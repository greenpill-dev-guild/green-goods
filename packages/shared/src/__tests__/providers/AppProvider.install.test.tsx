import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider, useApp } from "../../providers/App";

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
    vi.useRealTimers();
    localStorage.clear();
  });

  it("shows a localized success toast only when appinstalled fires", () => {
    vi.useFakeTimers();
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

    expect(toastMocks.success).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(4000);
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

  it("keeps install CTAs in an installing state until the install settles", async () => {
    vi.useFakeTimers();

    const prompt = vi.fn(() => Promise.resolve());
    const beforeInstallEvent = new Event("beforeinstallprompt") as BeforeInstallPromptEvent;
    Object.defineProperties(beforeInstallEvent, {
      prompt: { value: prompt },
      userChoice: {
        value: Promise.resolve({ outcome: "accepted", platform: "web" }),
      },
    });

    function InstallStateProbe() {
      const { installState, isInstalling, promptInstall } = useApp();
      return (
        <>
          <span data-testid="install-state">{installState}</span>
          <span data-testid="is-installing">{isInstalling ? "yes" : "no"}</span>
          <button type="button" onClick={promptInstall}>
            prompt install
          </button>
        </>
      );
    }

    render(
      <AppProvider allowPosthogKeyFallback={false}>
        <InstallStateProbe />
      </AppProvider>
    );

    act(() => {
      window.dispatchEvent(beforeInstallEvent);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "prompt install" }));
      await Promise.resolve();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("install-state")).toHaveTextContent("installing");
    expect(screen.getByTestId("is-installing")).toHaveTextContent("yes");

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(screen.getByTestId("install-state")).toHaveTextContent("installing");

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(screen.getByTestId("install-state")).toHaveTextContent("installing");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId("install-state")).toHaveTextContent("installed");
    expect(screen.getByTestId("is-installing")).toHaveTextContent("no");
  });
});
