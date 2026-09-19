/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createServiceWorkerRegistrationConfig,
  isLegacyServiceWorkerRegistration,
  registerServiceWorkerFromEnv,
  schedulePwaTailPreparation,
} from "../../../modules/app/service-worker-registration";
import { serviceWorkerManager } from "../../../modules/app/service-worker";

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
const originalConnection = Object.getOwnPropertyDescriptor(navigator, "connection");

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  if (originalServiceWorker) {
    Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
  } else {
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
  if (originalConnection) {
    Object.defineProperty(navigator, "connection", originalConnection);
  } else {
    Reflect.deleteProperty(navigator, "connection");
  }
  vi.useRealTimers();
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

  it("pauses the deferred tail under Data Saver and resumes it while idle", async () => {
    vi.useFakeTimers();
    const worker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    const serviceWorker = Object.assign(new EventTarget(), { controller: worker });
    const connection = Object.assign(new EventTarget(), { saveData: true });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorker,
    });
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: connection,
    });

    schedulePwaTailPreparation();
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "PAUSE_PWA_TAIL" });

    connection.saveData = false;
    connection.dispatchEvent(new Event("change"));
    await vi.advanceTimersByTimeAsync(0);

    // Every request carries a reply port, so any listener can hear the outcome.
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: "PREPARE_PWA_TAIL" }, [
      expect.any(MessagePort),
    ]);
  });

  it("asks for the offline-ready tier at once and reports what the worker answers", async () => {
    // A fresh module: tier requests are remembered for the life of the page.
    vi.resetModules();
    const { schedulePwaShellPreparation } = await import(
      "../../../modules/app/service-worker-registration"
    );
    const worker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    const serviceWorker = Object.assign(new EventTarget(), { controller: worker });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorker,
    });

    const statuses: string[] = [];
    schedulePwaShellPreparation("priority", (status) => statuses.push(status));

    // No idle callback: this is the tier that decides whether an installed app
    // can take a photo with no signal.
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "PREPARE_PWA_PRIORITY" }, [
      expect.any(MessagePort),
    ]);

    const [, transfer] = (worker.postMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      MessagePort[],
    ];
    transfer[0].postMessage({ status: "ready" });

    await vi.waitFor(() => expect(statuses).toEqual(["ready"]));
  });

  it("retries a failed offline-ready tier on reconnect", async () => {
    vi.resetModules();
    const connection = Object.assign(new EventTarget(), { saveData: false });
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: connection,
    });
    const { schedulePwaShellPreparation } = await import(
      "../../../modules/app/service-worker-registration"
    );
    const worker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: Object.assign(new EventTarget(), { controller: worker }),
    });

    const statuses: string[] = [];
    schedulePwaShellPreparation("priority", (status) => statuses.push(status));
    const [, firstTransfer] = (worker.postMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      MessagePort[],
    ];
    firstTransfer[0].postMessage({ status: "failed" });
    await vi.waitFor(() => expect(statuses).toEqual(["failed"]));

    connection.dispatchEvent(new Event("change"));
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    const [, retryTransfer] = (worker.postMessage as ReturnType<typeof vi.fn>).mock.calls[1] as [
      unknown,
      MessagePort[],
    ];
    retryTransfer[0].postMessage({ status: "ready" });
    await vi.waitFor(() => expect(statuses).toEqual(["failed", "ready"]));
  });

  it("answers a listener that registers after a callback-less request", async () => {
    // The real ordering after an update restart: `registerServiceWorker` asks
    // for the tier with no callback, then `PwaUpdateNotifier` asks again with
    // one. Remembering a single callback per tier dropped the second caller,
    // because the in-flight message had already gone out without a port.
    vi.resetModules();
    const { schedulePwaShellPreparation } = await import(
      "../../../modules/app/service-worker-registration"
    );
    const worker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: Object.assign(new EventTarget(), { controller: worker }),
    });

    schedulePwaShellPreparation("priority");
    const statuses: string[] = [];
    schedulePwaShellPreparation("priority", (status) => statuses.push(status));

    const withPort = (worker.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => Array.isArray(call[1]) && call[1].length > 0
    ) as [unknown, MessagePort[]] | undefined;
    expect(withPort, "no request carried a reply port").toBeDefined();
    withPort?.[1][0].postMessage({ status: "ready" });

    await vi.waitFor(() => expect(statuses).toEqual(["ready"]));
  });

  it("replays a settled outcome to a listener that arrives late", async () => {
    vi.resetModules();
    const { schedulePwaShellPreparation } = await import(
      "../../../modules/app/service-worker-registration"
    );
    const worker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: Object.assign(new EventTarget(), { controller: worker }),
    });

    const first: string[] = [];
    schedulePwaShellPreparation("priority", (status) => first.push(status));
    const [, transfer] = (worker.postMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      MessagePort[],
    ];
    transfer[0].postMessage({ status: "ready" });
    await vi.waitFor(() => expect(first).toEqual(["ready"]));

    // The worker runs one download per tier and will not answer again, so a
    // listener registering now must be told what already happened.
    const late: string[] = [];
    schedulePwaShellPreparation("priority", (status) => late.push(status));
    expect(late).toEqual(["ready"]);
  });

  it("lets a reader watch a tier without asking the worker to download it", async () => {
    // A browser tab that never installed the app must not start the
    // offline-ready download just because a photo is waiting for its decoder.
    vi.resetModules();
    const { observePwaShellTier, schedulePwaShellPreparation } = await import(
      "../../../modules/app/service-worker-registration"
    );
    const worker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: Object.assign(new EventTarget(), { controller: worker }),
    });

    const watched: string[] = [];
    const stop = observePwaShellTier("priority", (status) => watched.push(status));
    expect(worker.postMessage).not.toHaveBeenCalled();

    schedulePwaShellPreparation("priority");
    const [, transfer] = (worker.postMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      MessagePort[],
    ];
    transfer[0].postMessage({ status: "ready" });
    await vi.waitFor(() => expect(watched).toEqual(["ready"]));

    const late: string[] = [];
    observePwaShellTier("priority", (status) => late.push(status));
    expect(late).toEqual(["ready"]);
    stop();
  });

  it("forgets a tier's answer when a new worker takes control", async () => {
    vi.resetModules();
    const { currentPwaShellTierStatus, schedulePwaShellPreparation } = await import(
      "../../../modules/app/service-worker-registration"
    );
    const worker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    const container = Object.assign(new EventTarget(), { controller: worker });
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: container });

    schedulePwaShellPreparation("priority");
    const [, transfer] = (worker.postMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      MessagePort[],
    ];
    transfer[0].postMessage({ status: "ready" });
    await vi.waitFor(() => expect(currentPwaShellTierStatus("priority")).toBe("ready"));

    // The next worker's files are not known to be on the device until it answers.
    container.controller = { postMessage: vi.fn() } as unknown as ServiceWorker;
    container.dispatchEvent(new Event("controllerchange"));
    expect(currentPwaShellTierStatus("priority")).toBeUndefined();
  });

  it("stops telling a listener that unsubscribed", async () => {
    vi.resetModules();
    const { schedulePwaShellPreparation } = await import(
      "../../../modules/app/service-worker-registration"
    );
    const worker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: Object.assign(new EventTarget(), { controller: worker }),
    });

    const statuses: string[] = [];
    const stop = schedulePwaShellPreparation("priority", (status) => statuses.push(status));
    stop();

    const [, transfer] = (worker.postMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      MessagePort[],
    ];
    transfer[0].postMessage({ status: "ready" });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(statuses).toEqual([]);
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
