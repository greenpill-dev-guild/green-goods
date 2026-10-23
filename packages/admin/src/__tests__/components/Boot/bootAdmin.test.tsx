/**
 * @vitest-environment happy-dom
 *
 * Admin boot resilience: the root receives visible content whether the
 * optional services succeed or throw, and a failure to load or render the
 * application tree produces an actionable recovery card, never an empty root.
 */

import { createQueryPersistence } from "@green-goods/shared/config/query-persistence";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminBootServices, BootOutcome } from "@/components/Boot/bootAdmin";
import { bootAdmin } from "@/components/Boot/bootAdmin";

function Ready({ onWorkspaceReady }: { onWorkspaceReady?: () => void }) {
  useEffect(() => onWorkspaceReady?.(), [onWorkspaceReady]);
  return <div data-testid="admin-ready">Admin is ready</div>;
}

function Exploding(): never {
  throw new Error("AppKitProvider requires a browser environment");
}

const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");

function services(overrides: Partial<AdminBootServices> = {}): Partial<AdminBootServices> {
  return {
    loadRoot: async () => ({ default: Ready }),
    initTheme: () => undefined,
    initSentry: vi.fn(),
    initErrorHandlers: vi.fn(),
    initIpfs: vi.fn(async () => true),
    ...overrides,
  };
}

describe("bootAdmin", () => {
  let container: HTMLDivElement;
  let outcome: BootOutcome | null = null;

  beforeEach(() => {
    window.localStorage.setItem("greengoods_auth_mode", "wallet");
    container = document.createElement("div");
    container.id = "root";
    document.body.append(container);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    act(() => outcome?.unmount());
    outcome = null;
    container.remove();
    if (originalLocalStorage) {
      Object.defineProperty(window, "localStorage", originalLocalStorage);
    }
    window.sessionStorage.removeItem("greengoods_dev_mock_auth");
    window.localStorage.removeItem("gg-language");
    window.localStorage.removeItem("greengoods_auth_mode");
    window.localStorage.removeItem("greengoods_credential");
    vi.restoreAllMocks();
  });

  async function boot(overrides: Partial<AdminBootServices> = {}) {
    await act(async () => {
      outcome = await bootAdmin({ container, services: services(overrides) });
    });
    return outcome!;
  }

  /** Boots with the application tree held back, so the first frame stays on screen. */
  async function bootToFirstFrame() {
    let release: (() => void) | null = null;
    const gate = new Promise<{ default: typeof Ready }>((resolve) => {
      release = () => resolve({ default: Ready });
    });
    let pending!: Promise<BootOutcome>;
    await act(async () => {
      pending = bootAdmin({ container, services: services({ loadRoot: () => gate }) });
      await Promise.resolve();
    });
    return async () => {
      await act(async () => {
        release?.();
        outcome = await pending;
      });
    };
  }

  it("keeps fresh visitors on the connect prompt until one explicit click", async () => {
    window.localStorage.removeItem("greengoods_auth_mode");
    const loadRoot = vi.fn(async () => ({ default: Ready }));
    const initIpfs = vi.fn();
    await boot({ loadRoot, initIpfs });

    expect(container.textContent).toContain("Connect to continue");
    expect(container.querySelector("main")).not.toBeNull();
    expect(loadRoot).not.toHaveBeenCalled();
    expect(initIpfs).not.toHaveBeenCalled();
    const button = container.querySelector("button")!;
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await waitFor(() =>
      expect(container.querySelector('[data-testid="admin-ready"]')).not.toBeNull()
    );
    expect(loadRoot).toHaveBeenCalledTimes(1);
    expect(loadRoot).toHaveBeenCalledWith(true);
    expect(window.localStorage.getItem("greengoods_auth_mode")).toBeNull();
  });

  it.each([
    "deployer",
    "steward",
    "disconnected",
  ])("starts the development runtime for a persisted %s mock override without a URL parameter", async (role) => {
    window.localStorage.removeItem("greengoods_auth_mode");
    window.sessionStorage.setItem("greengoods_dev_mock_auth", role);
    const loadRoot = vi.fn(async () => ({ default: Ready }));
    await boot({ loadRoot });
    expect(loadRoot).toHaveBeenCalledWith(false);
    expect(window.sessionStorage.getItem("greengoods_dev_mock_auth")).toBe(role);
  });

  it("does not treat an invalid persisted mock role as a session", async () => {
    window.localStorage.removeItem("greengoods_auth_mode");
    window.sessionStorage.setItem("greengoods_dev_mock_auth", "invalid-role");
    const loadRoot = vi.fn(async () => ({ default: Ready }));
    await boot({ loadRoot });
    expect(loadRoot).not.toHaveBeenCalled();
  });

  it("starts a legacy passkey restore immediately even without an auth mode", async () => {
    window.localStorage.removeItem("greengoods_auth_mode");
    window.localStorage.setItem("greengoods_credential", "legacy-record");
    const loadRoot = vi.fn(async () => ({ default: Ready }));
    await boot({ loadRoot });
    expect(loadRoot).toHaveBeenCalledTimes(1);
    expect(loadRoot).toHaveBeenCalledWith(false);
    expect(window.localStorage.getItem("greengoods_credential")).toBe("legacy-record");
  });

  it("offers fresh passkey users the existing sign-in UI without requesting a wallet", async () => {
    window.localStorage.removeItem("greengoods_auth_mode");
    const received = vi.fn();
    function Runtime(props: { connectWalletOnReady?: boolean }) {
      received(props.connectWalletOnReady);
      return <Ready />;
    }
    await boot({ loadRoot: async () => ({ default: Runtime }) });
    expect(container.textContent).toContain("Sign in with Passkey");
    await act(async () => {
      fireEvent.click(container.querySelector('[data-testid="passkey-start-button"]')!);
    });
    expect(received).toHaveBeenCalledWith(false);
    expect(received).not.toHaveBeenCalledWith(true);
    expect(window.localStorage.getItem("greengoods_auth_mode")).toBeNull();
  });

  it.each([
    "storage",
    "pageshow",
    "visibilitychange",
  ])("rechecks a guest session on %s", async (event) => {
    window.localStorage.removeItem("greengoods_auth_mode");
    const loadRoot = vi.fn(async () => ({ default: Ready }));
    await boot({ loadRoot });
    expect(loadRoot).not.toHaveBeenCalled();
    window.localStorage.setItem("greengoods_auth_mode", "wallet");
    await act(async () => {
      (event === "visibilitychange" ? document : window).dispatchEvent(new Event(event));
    });
    await waitFor(() => expect(loadRoot).toHaveBeenCalledTimes(1));
  });

  it("removes guest listeners on unmount and never loads the runtime afterward", async () => {
    window.localStorage.removeItem("greengoods_auth_mode");
    const loadRoot = vi.fn(async () => ({ default: Ready }));
    await boot({ loadRoot });
    act(() => outcome?.unmount());
    outcome = null;
    window.localStorage.setItem("greengoods_auth_mode", "wallet");
    window.dispatchEvent(new Event("storage"));
    expect(loadRoot).not.toHaveBeenCalled();
  });

  it("shows recovery when loading after a guest click fails", async () => {
    window.localStorage.removeItem("greengoods_auth_mode");
    await boot({
      loadRoot: async () => {
        throw new Error("Wallet runtime unavailable");
      },
    });
    await act(async () => {
      fireEvent.click(container.querySelector("button")!);
    });
    await waitFor(() => expect(container.textContent).toContain("Wallet runtime unavailable"));
    expect(container.querySelector('[data-component="AdminBootRecovery"]')).not.toBeNull();
    expect(container.textContent).toContain("Reload");
  });

  it("drops a pending click handoff when another tab supplies a session during loading", async () => {
    window.localStorage.removeItem("greengoods_auth_mode");
    const received = vi.fn();
    function Runtime(props: { connectWalletOnReady?: boolean }) {
      received(props.connectWalletOnReady);
      return <Ready />;
    }
    let release!: () => void;
    const loaded = new Promise<{ default: typeof Runtime }>((resolve) => {
      release = () => resolve({ default: Runtime });
    });
    await boot({ loadRoot: () => loaded });
    await act(async () => {
      fireEvent.click(container.querySelector("button")!);
    });
    window.localStorage.setItem("greengoods_credential", "new-session");
    await act(async () => {
      window.dispatchEvent(new Event("storage"));
      release();
    });
    expect(received).toHaveBeenCalledWith(false);
    expect(received).not.toHaveBeenCalledWith(true);
  });

  it("does not mount a runtime that finishes downloading after unmount", async () => {
    window.localStorage.removeItem("greengoods_auth_mode");
    let release!: () => void;
    const loaded = new Promise<{ default: typeof Ready }>((resolve) => {
      release = () => resolve({ default: Ready });
    });
    const initIpfs = vi.fn();
    await boot({ loadRoot: () => loaded, initIpfs });
    await act(async () => {
      fireEvent.click(container.querySelector("button")!);
    });
    act(() => outcome?.unmount());
    outcome = null;
    await act(async () => {
      release();
    });
    expect(container.textContent).toBe("");
    expect(initIpfs).not.toHaveBeenCalled();
  });

  it("mounts the application after every optional service succeeds", async () => {
    const initSentry = vi.fn();
    const initErrorHandlers = vi.fn();
    const initIpfs = vi.fn(async () => true);
    const result = await boot({ initSentry, initErrorHandlers, initIpfs });

    expect(result.status).toBe("mounted");
    expect(container.querySelector('[data-testid="admin-ready"]')).not.toBeNull();
    await waitFor(() => expect(initIpfs).toHaveBeenCalledTimes(1));
    expect(initSentry).toHaveBeenCalledTimes(1);
    expect(initErrorHandlers).toHaveBeenCalledTimes(1);
    expect(result.diagnostics.failures).toEqual([]);
  });

  it("waits for workspace commit before starting services and consumes StrictMode readiness once", async () => {
    let workspaceReady!: () => void;
    function WaitingRuntime({ onWorkspaceReady }: { onWorkspaceReady?: () => void }) {
      workspaceReady = onWorkspaceReady!;
      return <div>Wallet modal pending</div>;
    }
    const initSentry = vi.fn();
    const initErrorHandlers = vi.fn();
    const initIpfs = vi.fn();
    await boot({
      loadRoot: async () => ({ default: WaitingRuntime }),
      initSentry,
      initErrorHandlers,
      initIpfs,
    });
    // Let the old root-level after-paint callback run, if it still exists.
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 50)));
    expect(initSentry).not.toHaveBeenCalled();
    expect(initErrorHandlers).not.toHaveBeenCalled();
    expect(initIpfs).not.toHaveBeenCalled();
    act(() => {
      workspaceReady();
      workspaceReady();
    });
    await waitFor(() => expect(initIpfs).toHaveBeenCalledTimes(1));
    expect(initSentry).toHaveBeenCalledTimes(1);
    expect(initErrorHandlers).toHaveBeenCalledTimes(1);
  });

  it("ignores a late workspace notification after unmount while keeping boot diagnostics", async () => {
    let workspaceReady!: () => void;
    function WaitingRuntime({ onWorkspaceReady }: { onWorkspaceReady?: () => void }) {
      workspaceReady = onWorkspaceReady!;
      return <div>Workspace loading</div>;
    }
    const initSentry = vi.fn();
    await boot({ loadRoot: async () => ({ default: WaitingRuntime }), initSentry });
    window.dispatchEvent(new ErrorEvent("error", { message: "early boot failure" }));
    expect(outcome?.diagnostics.failures).toContainEqual(
      expect.objectContaining({ stage: "runtime", message: "early boot failure" })
    );
    act(() => outcome?.unmount());
    outcome = null;
    act(() => workspaceReady());
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 50)));
    expect(initSentry).not.toHaveBeenCalled();
  });

  it("still mounts when Sentry initialization throws", async () => {
    const initErrorHandlers = vi.fn();
    const result = await boot({
      initSentry: () => {
        throw new TypeError("Sentry.init exploded");
      },
      initErrorHandlers,
    });

    expect(container.querySelector('[data-testid="admin-ready"]')).not.toBeNull();
    await waitFor(() => expect(initErrorHandlers).toHaveBeenCalledTimes(1));
    expect(result.diagnostics.failures).toEqual([
      expect.objectContaining({ stage: "sentry", message: "TypeError: Sentry.init exploded" }),
    ]);
  });

  it("still mounts when merely reading window.localStorage throws", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Access is denied for this document.", "SecurityError");
      },
    });
    expect(() => window.localStorage).toThrow(/Access is denied/);

    // The application tree builds its query persister at module load, exactly
    // where the old entry point used to throw.
    const result = await boot({
      loadRoot: async () => {
        createQueryPersistence({ dbName: "gg-admin-boot-test" });
        return { default: Ready };
      },
      initTheme: () => {
        // The real theme init also touches storage; prove a throw here is contained too.
        throw new DOMException("Access is denied for this document.", "SecurityError");
      },
    });

    expect(result.status).toBe("mounted");
    expect(container.querySelector('[data-testid="admin-ready"]')).not.toBeNull();
    expect(result.diagnostics.failures).toEqual([expect.objectContaining({ stage: "theme" })]);
  });

  it("still mounts when the IPFS initializer rejects", async () => {
    const result = await boot({
      initIpfs: async () => {
        throw new Error("pinata unreachable");
      },
    });

    expect(container.querySelector('[data-testid="admin-ready"]')).not.toBeNull();
    await waitFor(() =>
      expect(result.diagnostics.failures).toEqual([
        expect.objectContaining({ stage: "ipfs", message: "Error: pinata unreachable" }),
      ])
    );
  });

  it("renders the recovery card when the application tree cannot be loaded", async () => {
    const result = await boot({
      loadRoot: async () => {
        throw new TypeError("Failed to fetch dynamically imported module");
      },
    });

    expect(result.status).toBe("failed");
    const card = container.querySelector('[data-component="AdminBootRecovery"]');
    expect(card).not.toBeNull();
    expect(card?.getAttribute("role")).toBe("alert");
    expect(container.textContent).toContain("Green Goods Admin could not start");
    expect(container.textContent).toContain("Failed to fetch dynamically imported module");
    expect(container.querySelector("button")).not.toBeNull();
    expect(result.diagnostics.failures).toEqual([expect.objectContaining({ stage: "load-root" })]);
  });

  it("renders the recovery card when the application tree throws during render", async () => {
    const result = await boot({ loadRoot: async () => ({ default: Exploding }) });

    expect(result.status).toBe("mounted");
    await waitFor(() =>
      expect(container.querySelector('[data-component="AdminBootRecovery"]')).not.toBeNull()
    );
    expect(container.textContent).toContain("AppKitProvider requires a browser environment");
    expect(result.diagnostics.failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ stage: "render" })])
    );
  });

  it("never leaves the root empty between the first frame and the application", async () => {
    const finish = await bootToFirstFrame();

    expect(container.querySelector('[data-component="AdminLoadingScreen"]')).not.toBeNull();
    expect(container.textContent).toContain("Opening your workspace");

    await finish();
    expect(container.querySelector('[data-testid="admin-ready"]')).not.toBeNull();
  });

  it("writes the first frame in the stored language, not the browser's, and declares it", async () => {
    window.localStorage.setItem("gg-language", "es");
    const finish = await bootToFirstFrame();

    const shell = container.querySelector('[data-component="AdminLoadingScreen"]');
    expect(shell?.textContent).toContain("Abriendo tu espacio de trabajo");
    expect(shell?.getAttribute("lang")).toBe("es");

    await finish();
  });

  it("writes the recovery card in the browser's language when none is stored, and declares it", async () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["fr-FR", "pt-BR"]);
    await boot({
      loadRoot: async () => {
        throw new TypeError("Failed to fetch dynamically imported module");
      },
    });

    const card = container.querySelector('[data-component="AdminBootRecovery"]');
    expect(card?.textContent).toContain("O Green Goods Admin não conseguiu iniciar");
    expect(card?.getAttribute("lang")).toBe("pt");
  });
});
