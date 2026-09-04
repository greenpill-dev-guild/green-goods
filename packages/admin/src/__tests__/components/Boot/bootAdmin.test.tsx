/**
 * @vitest-environment jsdom
 *
 * Admin boot resilience: the root receives visible content whether the
 * optional services succeed or throw, and a failure to load or render the
 * application tree produces an actionable recovery card, never an empty root.
 */

import { createQueryPersister } from "@green-goods/shared/config/query-persistence";
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminBootServices, BootOutcome } from "@/components/Boot/bootAdmin";
import { bootAdmin } from "@/components/Boot/bootAdmin";

function Ready() {
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
    vi.restoreAllMocks();
  });

  async function boot(overrides: Partial<AdminBootServices> = {}) {
    await act(async () => {
      outcome = await bootAdmin({ container, services: services(overrides) });
    });
    return outcome!;
  }

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
        createQueryPersister({ dbName: "gg-admin-boot-test" });
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
    let release: (() => void) | null = null;
    const gate = new Promise<{ default: typeof Ready }>((resolve) => {
      release = () => resolve({ default: Ready });
    });
    let pending!: Promise<BootOutcome>;
    await act(async () => {
      pending = bootAdmin({ container, services: services({ loadRoot: () => gate }) });
      await Promise.resolve();
    });

    expect(container.querySelector('[data-component="AdminBootShell"]')).not.toBeNull();
    expect(container.textContent).toContain("Loading Green Goods Admin");

    await act(async () => {
      release?.();
      outcome = await pending;
    });
    expect(container.querySelector('[data-testid="admin-ready"]')).not.toBeNull();
  });
});
