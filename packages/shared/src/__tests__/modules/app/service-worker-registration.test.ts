/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createServiceWorkerRegistrationConfig,
  isLegacyServiceWorkerRegistration,
  registerServiceWorkerFromEnv,
} from "../../../modules/app/service-worker-registration";
import { serviceWorkerManager } from "../../../modules/app/service-worker";

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  if (originalServiceWorker) {
    Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
  } else {
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
});

describe("service worker registration config", () => {
  it("builds a scoped registration for the /home app namespace", () => {
    const config = createServiceWorkerRegistrationConfig("release-123456", {
      scriptUrl: "/sw.js",
      scope: "/home",
      legacyScopes: ["/"],
    });

    expect(config.scriptUrl).toBe("/sw.js");
    expect(config.options).toEqual({ scope: "/home", updateViaCache: "none" });
    expect(config.legacyScopes).toEqual(["/"]);
  });

  it("supports relative service worker scripts for hash-router builds", () => {
    const config = createServiceWorkerRegistrationConfig("release-123456", {
      scriptUrl: "./sw.js",
      scope: "./",
    });

    expect(config.scriptUrl).toBe("./sw.js");
    expect(config.options).toEqual({ scope: "./", updateViaCache: "none" });
  });

  it("keeps Vite PWA's exact development worker URL", async () => {
    const registration = {
      scope: "https://localhost:3001/home",
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register,
        ready: Promise.resolve(registration),
      },
    });
    vi.spyOn(serviceWorkerManager, "canRegister").mockReturnValue(true);
    vi.spyOn(serviceWorkerManager, "attachRegistration").mockImplementation(() => undefined);
    vi.spyOn(serviceWorkerManager, "isBackgroundSyncSupported").mockReturnValue(false);

    await expect(
      registerServiceWorkerFromEnv(
        {
          DEV: true,
          PROD: false,
          VITE_ENABLE_SW_DEV: "true",
          VITE_APP_VERSION: "0.4.0",
        },
        { scriptUrl: "/dev-sw.js?dev-sw", scope: "/home" }
      )
    ).resolves.toBe(true);

    expect(register).toHaveBeenCalledWith("/dev-sw.js?dev-sw", {
      scope: "/home",
      updateViaCache: "none",
    });
  });

  it("detects root-scoped legacy registrations but keeps the current app scope", () => {
    expect(isLegacyServiceWorkerRegistration("https://www.greengoods.app/", "/home", ["/"])).toBe(
      true
    );
    expect(
      isLegacyServiceWorkerRegistration("https://www.greengoods.app/home", "/home", ["/"])
    ).toBe(false);
  });

  it("registers on public production pages even without Background Sync", async () => {
    const registration = {
      scope: "https://www.greengoods.app/home/",
    } as unknown as ServiceWorkerRegistration;
    const legacyRegistration = {
      scope: "https://www.greengoods.app/",
      unregister: vi.fn().mockResolvedValue(true),
    } as unknown as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register,
        getRegistrations: vi.fn().mockResolvedValue([legacyRegistration]),
        ready: Promise.resolve(registration),
      },
    });
    vi.spyOn(serviceWorkerManager, "canRegister").mockReturnValue(true);
    vi.spyOn(serviceWorkerManager, "attachRegistration").mockImplementation(() => undefined);
    vi.spyOn(serviceWorkerManager, "isBackgroundSyncSupported").mockReturnValue(false);

    await expect(
      registerServiceWorkerFromEnv(
        { DEV: false, PROD: true, VITE_APP_VERSION: "0.4.0" },
        { scriptUrl: "/sw.js", scope: "/home/", legacyScopes: ["/"] }
      )
    ).resolves.toBe(true);

    expect(legacyRegistration.unregister).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith("/sw.js", {
      scope: "/home/",
      updateViaCache: "none",
    });
  });

  it("only performs the legacy root-scope cleanup once", async () => {
    const legacyRegistration = {
      scope: "https://www.greengoods.app/",
      unregister: vi.fn().mockResolvedValue(true),
    } as unknown as ServiceWorkerRegistration;
    const currentRegistration = {
      scope: "https://www.greengoods.app/home/",
    } as unknown as ServiceWorkerRegistration;
    const getRegistrations = vi.fn().mockResolvedValue([legacyRegistration]);
    const register = vi.fn().mockResolvedValue(currentRegistration);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register,
        getRegistrations,
        ready: Promise.resolve(currentRegistration),
      },
    });
    vi.spyOn(serviceWorkerManager, "canRegister").mockReturnValue(true);
    vi.spyOn(serviceWorkerManager, "attachRegistration").mockImplementation(() => undefined);
    vi.spyOn(serviceWorkerManager, "isBackgroundSyncSupported").mockReturnValue(false);

    const env = { DEV: false, PROD: true, VITE_APP_VERSION: "0.4.0" };
    const config = { scriptUrl: "/sw.js", scope: "/home/", legacyScopes: ["/"] };
    await registerServiceWorkerFromEnv(env, config);
    await registerServiceWorkerFromEnv(env, config);

    expect(getRegistrations).toHaveBeenCalledTimes(1);
    expect(legacyRegistration.unregister).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(2);
  });

  it("normalizes long invalid scopes without a backtracking regular expression", () => {
    const invalidLegacyScope = "http://[invalid";
    const registrationScope = `${invalidLegacyScope}${"/".repeat(50_000)}`;

    expect(
      isLegacyServiceWorkerRegistration(registrationScope, "/home", [invalidLegacyScope])
    ).toBe(true);
  });
});
