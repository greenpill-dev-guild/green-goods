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

const posthogMocks = vi.hoisted(() => ({
  track: vi.fn(),
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
  track: posthogMocks.track,
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

function createBeforeInstallEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const prompt = vi.fn(() => Promise.resolve());
  const event = new Event("beforeinstallprompt") as BeforeInstallPromptEvent;
  Object.defineProperties(event, {
    prompt: { value: prompt },
    userChoice: {
      value: Promise.resolve({ outcome, platform: "web" }),
    },
  });

  return { event, prompt };
}

function InstallStateProbe() {
  const { installState, isInstalled, isInstalling, promptInstall } = useApp();
  return (
    <>
      <span data-testid="install-state">{installState}</span>
      <span data-testid="is-installing">{isInstalling ? "yes" : "no"}</span>
      <span data-testid="is-installed">{isInstalled ? "yes" : "no"}</span>
      <button type="button" onClick={promptInstall}>
        prompt install
      </button>
    </>
  );
}

function expectInstallState(state: string) {
  expect(screen.getByTestId("install-state")).toHaveTextContent(new RegExp(`^${state}$`));
}

describe("AppProvider install confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("shows a localized success toast only when final install readiness resolves", () => {
    vi.useFakeTimers();
    localStorage.setItem("gg-language", "es");

    render(
      <AppProvider allowPosthogKeyFallback={false}>
        <InstallStateProbe />
      </AppProvider>
    );

    expect(toastMocks.success).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expectInstallState("finalizing");

    act(() => {
      vi.advanceTimersByTime(29_999);
    });

    expect(toastMocks.success).not.toHaveBeenCalled();
    expectInstallState("finalizing");

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
      vi.advanceTimersByTime(999);
    });

    expect(toastMocks.success).not.toHaveBeenCalled();
    expectInstallState("finalizing");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expectInstallState("installed");
    expect(toastMocks.success).toHaveBeenCalledTimes(1);
    expect(toastMocks.success).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "App instalada",
        message: "Green Goods está lista desde tu pantalla de inicio.",
        context: "pwa install",
      })
    );
    // Two events observed → confirmed off the WebAPK-ready event, not the fallback.
    expect(posthogMocks.track).toHaveBeenCalledWith(
      "App Installed",
      expect.objectContaining({
        appinstalled_event_count: 2,
        settled_via_fallback: false,
      })
    );
  });

  it("keeps first appinstalled in finalizing until the fallback resolves readiness", () => {
    vi.useFakeTimers();

    render(
      <AppProvider allowPosthogKeyFallback={false}>
        <InstallStateProbe />
      </AppProvider>
    );

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expectInstallState("finalizing");
    expect(screen.getByTestId("is-installing")).toHaveTextContent("yes");
    expect(screen.getByTestId("is-installed")).toHaveTextContent("no");

    act(() => {
      vi.advanceTimersByTime(29_999);
    });

    expectInstallState("finalizing");
    expect(screen.getByTestId("is-installing")).toHaveTextContent("yes");
    expect(screen.getByTestId("is-installed")).toHaveTextContent("no");
    expect(toastMocks.success).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expectInstallState("installed");
    expect(screen.getByTestId("is-installing")).toHaveTextContent("no");
    expect(screen.getByTestId("is-installed")).toHaveTextContent("yes");
    expect(toastMocks.success).toHaveBeenCalledTimes(1);
    // Single event → we settled via the blind 30s fallback. This is the flag the
    // on-device experiment watches: a high `settled_via_fallback` rate means the
    // two-event assumption is wrong and the gate needs a real readiness probe.
    expect(posthogMocks.track).toHaveBeenCalledWith(
      "App Installed",
      expect.objectContaining({
        appinstalled_event_count: 1,
        settled_via_fallback: true,
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

  it("clears active session and volatile caches once when a prior install is replaced", async () => {
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

    expect(screen.getByText("content")).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_MODE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(EMBEDDED_ADDRESS_KEY)).toBeNull();
    expect(localStorage.getItem(SIGNED_OUT_STORAGE_KEY)).toBe("true");
    expect(localStorage.getItem(USERNAME_STORAGE_KEY)).toBe("afo");
    expect(localStorage.getItem("greengoods_credential")).toBe(credential);
    expect(localStorage.getItem(SMART_ACCOUNT_ADDRESS_STORAGE_KEY)).toBe(address);
    expect(cacheMocks.queryClear).toHaveBeenCalledTimes(1);
    expect(cacheMocks.clearAllCaches).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
      vi.advanceTimersByTime(1_000);
    });

    expect(cacheMocks.queryClear).toHaveBeenCalledTimes(1);
    expect(cacheMocks.clearAllCaches).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
      vi.advanceTimersByTime(30_000);
    });

    expect(cacheMocks.queryClear).toHaveBeenCalledTimes(1);
    expect(cacheMocks.clearAllCaches).toHaveBeenCalledTimes(1);
    expect(toastMocks.success).toHaveBeenCalledTimes(1);
  });

  it("keeps install CTAs installing after prompt acceptance until appinstalled starts finalizing", async () => {
    vi.useFakeTimers();

    const { event, prompt } = createBeforeInstallEvent("accepted");

    render(
      <AppProvider allowPosthogKeyFallback={false}>
        <InstallStateProbe />
      </AppProvider>
    );

    act(() => {
      window.dispatchEvent(event);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "prompt install" }));
      await Promise.resolve();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expectInstallState("installing");
    expect(screen.getByTestId("is-installing")).toHaveTextContent("yes");
    expect(screen.getByTestId("is-installed")).toHaveTextContent("no");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expectInstallState("installing");
    expect(screen.getByTestId("is-installing")).toHaveTextContent("yes");
    expect(screen.getByTestId("is-installed")).toHaveTextContent("no");

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expectInstallState("finalizing");
    expect(screen.getByTestId("is-installing")).toHaveTextContent("yes");
    expect(screen.getByTestId("is-installed")).toHaveTextContent("no");
  });

  it("returns to not-installed when the prompt is dismissed", async () => {
    vi.useFakeTimers();

    const { event, prompt } = createBeforeInstallEvent("dismissed");

    render(
      <AppProvider allowPosthogKeyFallback={false}>
        <InstallStateProbe />
      </AppProvider>
    );

    act(() => {
      window.dispatchEvent(event);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "prompt install" }));
      await Promise.resolve();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expectInstallState("not-installed");
    expect(screen.getByTestId("is-installing")).toHaveTextContent("no");
    expect(screen.getByTestId("is-installed")).toHaveTextContent("no");
  });
});
