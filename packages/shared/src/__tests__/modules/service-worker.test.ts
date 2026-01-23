import { describe, it, expect, vi, beforeEach } from "vitest";

import { serviceWorkerManager } from "../../modules/app/service-worker";

describe("modules/service-worker", () => {
  beforeEach(() => {
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
  });

  it("exposes status shape", () => {
    const status = serviceWorkerManager.getStatus();
    expect(status).toHaveProperty("isSupported");
    expect(status).toHaveProperty("isRegistered");
  });
});
