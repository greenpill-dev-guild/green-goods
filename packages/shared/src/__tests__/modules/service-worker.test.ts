import { describe, it, expect, vi, beforeEach } from "vitest";

import { serviceWorkerManager } from "../../modules/app/service-worker";

describe("modules/service-worker", () => {
  beforeEach(() => {
    // Ensure environment resembles dev without SW
    (global as any).navigator.serviceWorker = {
      register: vi.fn().mockRejectedValue(new Error("no sw in tests")),
      ready: Promise.resolve({}) as any,
      addEventListener: vi.fn(),
      controller: undefined,
    } as any;
  });

  it("exposes status shape", () => {
    const status = serviceWorkerManager.getStatus();
    expect(status).toHaveProperty("isSupported");
    expect(status).toHaveProperty("isRegistered");
  });
});
