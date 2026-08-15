import { beforeEach, describe, expect, it, vi } from "vitest";

type ServiceWorkerManager =
  typeof import("../../modules/app/service-worker")["serviceWorkerManager"];

let serviceWorkerManager: ServiceWorkerManager;

describe("modules/service-worker", () => {
  beforeEach(async () => {
    vi.resetModules();

    // Use Object.defineProperty to mock navigator.serviceWorker
    // since it's a read-only property in modern browsers
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockRejectedValue(new Error("no sw in tests")),
        ready: Promise.resolve({}) as any,
        addEventListener: vi.fn(),
        controller: undefined,
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(window, "ServiceWorkerRegistration", {
      value: class ServiceWorkerRegistration {},
      configurable: true,
      writable: true,
    });

    ({ serviceWorkerManager } = await import("../../modules/app/service-worker"));
  });

  it("exposes status shape", () => {
    const status = serviceWorkerManager.getStatus();
    expect(status).toHaveProperty("isSupported");
    expect(status).toHaveProperty("isRegistered");
  });

  it("can register a service worker when Background Sync is unavailable", () => {
    expect("sync" in ServiceWorkerRegistration.prototype).toBe(false);
    expect(serviceWorkerManager.canRegister()).toBe(true);
    expect(serviceWorkerManager.isBackgroundSyncSupported()).toBe(false);
  });

  it("removes React Query localStorage persistence when clearing caches", async () => {
    localStorage.setItem("__rq_pc__", JSON.stringify({ timestamp: Date.now() }));

    await serviceWorkerManager.clearAllCaches();

    expect(localStorage.getItem("__rq_pc__")).toBeNull();
  });
});
