import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_MODE_STORAGE_KEY,
  EMBEDDED_ADDRESS_KEY,
  SIGNED_OUT_STORAGE_KEY,
  SMART_ACCOUNT_ADDRESS_STORAGE_KEY,
  USERNAME_STORAGE_KEY,
} from "../../modules/auth/session";
import { AppProvider, useApp } from "../../providers/App";

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
}));

const cacheMocks = vi.hoisted(() => ({
  clearAllCaches: vi.fn(() => Promise.resolve()),
  queryClear: vi.fn(),
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

vi.mock("../../modules/app/service-worker", () => ({
  serviceWorkerManager: {
    clearAllCaches: cacheMocks.clearAllCaches,
  },
}));

vi.mock("../../config/react-query", () => ({
  queryClient: {
    clear: cacheMocks.queryClear,
  },
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

  it("preserves the active session on first install", async () => {
    vi.useFakeTimers();

    const address = "0x1234567890123456789012345678901234567890";

    localStorage.setItem(AUTH_MODE_STORAGE_KEY, "passkey");
    localStorage.setItem(EMBEDDED_ADDRESS_KEY, address);

    render(
      <AppProvider allowPosthogKeyFallback={false}>
        <span>content</span>
      </AppProvider>
    );

    await act(async () => {
      window.dispatchEvent(new Event("appinstalled"));
      await Promise.resolve();
    });

    expect(localStorage.getItem("gg-pwa-installed")).toBe("true");
    expect(localStorage.getItem(AUTH_MODE_STORAGE_KEY)).toBe("passkey");
    expect(localStorage.getItem(EMBEDDED_ADDRESS_KEY)).toBe(address);
    expect(cacheMocks.queryClear).not.toHaveBeenCalled();
    expect(cacheMocks.clearAllCaches).not.toHaveBeenCalled();
  });

  it("clears active session and volatile caches when reinstall completes", async () => {
    vi.useFakeTimers();

    const address = "0x1234567890123456789012345678901234567890";
    const credential = JSON.stringify({ id: "credential-id", publicKey: "0x1234" });

    localStorage.setItem("gg-pwa-installed", "true");
    localStorage.setItem(AUTH_MODE_STORAGE_KEY, "passkey");
    localStorage.setItem(EMBEDDED_ADDRESS_KEY, address);
    localStorage.setItem(USERNAME_STORAGE_KEY, "afo");
    localStorage.setItem("greengoods_credential", credential);
    localStorage.setItem(SMART_ACCOUNT_ADDRESS_STORAGE_KEY, address);

    render(
      <AppProvider allowPosthogKeyFallback={false}>
        <span>content</span>
      </AppProvider>
    );

    await act(async () => {
      window.dispatchEvent(new Event("appinstalled"));
      await Promise.resolve();
    });

    expect(localStorage.getItem(AUTH_MODE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(EMBEDDED_ADDRESS_KEY)).toBeNull();
    expect(localStorage.getItem(SIGNED_OUT_STORAGE_KEY)).toBe("true");
    expect(localStorage.getItem(USERNAME_STORAGE_KEY)).toBe("afo");
    expect(localStorage.getItem("greengoods_credential")).toBe(credential);
    expect(localStorage.getItem(SMART_ACCOUNT_ADDRESS_STORAGE_KEY)).toBe(address);
    expect(cacheMocks.queryClear).toHaveBeenCalledTimes(1);
    expect(cacheMocks.clearAllCaches).toHaveBeenCalledTimes(1);
  });

  it("keeps install CTAs installing after prompt acceptance until appinstalled settles", async () => {
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
      vi.advanceTimersByTime(60_000);
    });

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
