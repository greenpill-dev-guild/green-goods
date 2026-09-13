/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activateWaitingWorker,
  buildUpdateTelemetry,
  consumeUpdateApplied,
  createInstallWatcher,
  DOWNLOAD_TIMEOUT_MS,
  markUpdateApplied,
  waitForInstallToSettle,
} from "../../../modules/app/service-worker-update";

type Listener = () => void;

function createTarget<T extends object>(base: T) {
  const listeners: Record<string, Listener[]> = {};
  return Object.assign(base, {
    addEventListener: vi.fn((type: string, listener: Listener) => {
      listeners[type] = [...(listeners[type] ?? []), listener];
    }),
    removeEventListener: vi.fn((type: string, listener: Listener) => {
      listeners[type] = (listeners[type] ?? []).filter((item) => item !== listener);
    }),
    dispatch: (type: string) => {
      listeners[type]?.forEach((listener) => listener());
    },
    listenerCount: (type: string) => (listeners[type] ?? []).length,
  });
}

function createWorker(state: ServiceWorkerState, scriptURL = "https://www.greengoods.app/sw.js") {
  return createTarget({ state, scriptURL, postMessage: vi.fn() });
}

function createRegistration(
  overrides: { waiting?: ServiceWorker | null; installing?: ServiceWorker | null } = {}
) {
  return createTarget({ waiting: null, installing: null, ...overrides });
}

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

const asWorker = (worker: object) => worker as unknown as ServiceWorker;

function stubServiceWorkerContainer(controller: object | null) {
  const container = createTarget({ controller: controller as ServiceWorker | null });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: container });
  return container;
}

afterEach(() => {
  vi.useRealTimers();
  if (originalServiceWorker) {
    Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
  } else {
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
});

describe("buildUpdateTelemetry", () => {
  it("stamps the active and waiting worker versions from the gg_v query on every event", () => {
    stubServiceWorkerContainer(createWorker("activated", "/sw.js?gg_v=old"));
    const waiting = createWorker("installed", "/sw.js?gg_v=new") as unknown as ServiceWorker;

    expect(buildUpdateTelemetry(waiting, { source: "test" })).toEqual(
      expect.objectContaining({
        active_worker_version: "old",
        waiting_worker_version: "new",
        source: "test",
      })
    );
    expect(buildUpdateTelemetry(null)).toEqual(
      expect.objectContaining({ waiting_worker_version: "unknown" })
    );
  });
});

describe("createInstallWatcher", () => {
  function createHandlers() {
    return {
      onDownloading: vi.fn(),
      onInstalled: vi.fn(),
      onFirstInstall: vi.fn(),
      onFailed: vi.fn(),
      onTimeout: vi.fn(),
    };
  }

  it("reports a download and then the installed worker when a controller exists", () => {
    stubServiceWorkerContainer(createWorker("activated"));
    const handlers = createHandlers();
    const watcher = createInstallWatcher(handlers);
    const installing = createWorker("installing");

    watcher.watch(asWorker(installing), "update_found");
    watcher.watch(asWorker(installing), "manual_check");

    expect(handlers.onDownloading).toHaveBeenCalledTimes(1);
    expect(installing.listenerCount("statechange")).toBe(1);

    installing.state = "installed";
    installing.dispatch("statechange");

    expect(handlers.onInstalled).toHaveBeenCalledWith(installing, "update_found");
    expect(handlers.onFirstInstall).not.toHaveBeenCalled();

    // A settled worker going redundant later is a replacement, not a failure.
    installing.state = "redundant";
    installing.dispatch("statechange");
    expect(handlers.onFailed).not.toHaveBeenCalled();
  });

  it("treats a worker installing without a controller as the first install", () => {
    stubServiceWorkerContainer(null);
    const handlers = createHandlers();
    const watcher = createInstallWatcher(handlers);
    const installing = createWorker("installing");

    watcher.watch(asWorker(installing), "initial_check");
    expect(handlers.onDownloading).not.toHaveBeenCalled();

    installing.state = "installed";
    installing.dispatch("statechange");

    expect(handlers.onFirstInstall).toHaveBeenCalledWith("initial_check");
    expect(handlers.onInstalled).not.toHaveBeenCalled();
  });

  it("reports a failed install when the worker goes redundant before installing", () => {
    stubServiceWorkerContainer(createWorker("activated"));
    const handlers = createHandlers();
    const watcher = createInstallWatcher(handlers);
    const installing = createWorker("installing");

    watcher.watch(asWorker(installing), "auto_check");
    installing.state = "redundant";
    installing.dispatch("statechange");

    expect(handlers.onFailed).toHaveBeenCalledWith("auto_check");
    expect(handlers.onInstalled).not.toHaveBeenCalled();
  });

  it("times out a download that never settles and stays quiet once it does", () => {
    vi.useFakeTimers();
    stubServiceWorkerContainer(createWorker("activated"));
    const handlers = createHandlers();
    const watcher = createInstallWatcher(handlers);
    const installing = createWorker("installing");

    watcher.watch(asWorker(installing), "update_found");
    vi.advanceTimersByTime(DOWNLOAD_TIMEOUT_MS);
    expect(handlers.onTimeout).toHaveBeenCalledWith("update_found");

    // The listener stays attached, so a late install still surfaces.
    installing.state = "installed";
    installing.dispatch("statechange");
    expect(handlers.onInstalled).toHaveBeenCalledWith(installing, "update_found");

    const second = createWorker("installing");
    watcher.watch(asWorker(second), "update_found");
    second.state = "installed";
    second.dispatch("statechange");
    vi.advanceTimersByTime(DOWNLOAD_TIMEOUT_MS);
    expect(handlers.onTimeout).toHaveBeenCalledTimes(1);
  });

  it("drops the listener and the watchdog on dispose", () => {
    vi.useFakeTimers();
    stubServiceWorkerContainer(createWorker("activated"));
    const handlers = createHandlers();
    const watcher = createInstallWatcher(handlers);
    const installing = createWorker("installing");

    watcher.watch(asWorker(installing), "update_found");
    watcher.dispose();
    vi.advanceTimersByTime(DOWNLOAD_TIMEOUT_MS);

    expect(installing.listenerCount("statechange")).toBe(0);
    expect(handlers.onTimeout).not.toHaveBeenCalled();
  });
});

describe("waitForInstallToSettle", () => {
  it("returns a worker that is already waiting without listening", async () => {
    const waiting = createWorker("installed");
    const registration = createRegistration({ waiting: waiting as unknown as ServiceWorker });
    const onInstalling = vi.fn();

    await expect(
      waitForInstallToSettle(registration as unknown as ServiceWorkerRegistration, onInstalling)
    ).resolves.toEqual({ status: "installed", worker: waiting });

    expect(registration.addEventListener).not.toHaveBeenCalled();
    expect(onInstalling).not.toHaveBeenCalled();
  });

  it("settles as installed once the worker found by the check reaches installed", async () => {
    stubServiceWorkerContainer(createWorker("activated"));
    const installing = createWorker("installing");
    const registration = createRegistration({ installing: installing as unknown as ServiceWorker });
    const onInstalling = vi.fn();

    const settled = waitForInstallToSettle(
      registration as unknown as ServiceWorkerRegistration,
      onInstalling
    );
    expect(installing.listenerCount("statechange")).toBe(1);

    installing.state = "installed";
    installing.dispatch("statechange");

    await expect(settled).resolves.toEqual({ status: "installed", worker: installing });
    // The check already saw this worker installing, so there is no new download to report.
    expect(onInstalling).not.toHaveBeenCalled();
    expect(installing.listenerCount("statechange")).toBe(0);
    expect(registration.listenerCount("updatefound")).toBe(0);
  });

  it("settles as a first install when nothing controls the page", async () => {
    stubServiceWorkerContainer(null);
    const installing = createWorker("installing");
    const registration = createRegistration({ installing: installing as unknown as ServiceWorker });

    const settled = waitForInstallToSettle(
      registration as unknown as ServiceWorkerRegistration,
      vi.fn()
    );
    installing.state = "installed";
    installing.dispatch("statechange");

    await expect(settled).resolves.toEqual({ status: "first-install" });
  });

  it("settles as failed when the worker goes redundant before installing", async () => {
    stubServiceWorkerContainer(createWorker("activated"));
    const installing = createWorker("installing");
    const registration = createRegistration({ installing: installing as unknown as ServiceWorker });

    const settled = waitForInstallToSettle(
      registration as unknown as ServiceWorkerRegistration,
      vi.fn()
    );
    installing.state = "redundant";
    installing.dispatch("statechange");

    await expect(settled).resolves.toEqual({ status: "failed" });
  });

  it("settles synchronously for a worker that already finished", async () => {
    stubServiceWorkerContainer(createWorker("activated"));
    const installing = createWorker("installed");
    const registration = createRegistration({ installing: installing as unknown as ServiceWorker });

    await expect(
      waitForInstallToSettle(registration as unknown as ServiceWorkerRegistration, vi.fn())
    ).resolves.toEqual({ status: "installed", worker: installing });
    expect(registration.listenerCount("updatefound")).toBe(0);
  });

  it("reports a worker that starts installing during the wait, then returns it", async () => {
    stubServiceWorkerContainer(createWorker("activated"));
    const registration = createRegistration();
    const onInstalling = vi.fn();

    const settled = waitForInstallToSettle(
      registration as unknown as ServiceWorkerRegistration,
      onInstalling
    );
    const installing = createWorker("installing");
    registration.installing = installing as unknown as ServiceWorker;
    registration.dispatch("updatefound");

    expect(onInstalling).toHaveBeenCalledTimes(1);

    installing.state = "installed";
    installing.dispatch("statechange");

    await expect(settled).resolves.toEqual({ status: "installed", worker: installing });
  });

  it("gives up with a timeout once the wait passes with nothing settled", async () => {
    vi.useFakeTimers();
    const registration = createRegistration();
    const onInstalling = vi.fn();

    const settled = waitForInstallToSettle(
      registration as unknown as ServiceWorkerRegistration,
      onInstalling
    );
    vi.advanceTimersByTime(DOWNLOAD_TIMEOUT_MS);

    await expect(settled).resolves.toEqual({ status: "timeout" });
    expect(onInstalling).not.toHaveBeenCalled();
    expect(registration.listenerCount("updatefound")).toBe(0);
  });
});

describe("activateWaitingWorker", () => {
  it("listens for the controller change before asking the worker to skip waiting", () => {
    vi.useFakeTimers();
    const container = stubServiceWorkerContainer(createWorker("activated"));
    const worker = createWorker("installed");
    const handlers = { onActivated: vi.fn(), onTimeout: vi.fn() };

    activateWaitingWorker(worker as unknown as ServiceWorker, handlers, 1_000);

    expect(container.addEventListener).toHaveBeenCalledWith(
      "controllerchange",
      expect.any(Function),
      { once: true }
    );
    expect(container.addEventListener.mock.invocationCallOrder[0]).toBeLessThan(
      worker.postMessage.mock.invocationCallOrder[0]
    );
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    container.dispatch("controllerchange");
    vi.advanceTimersByTime(1_000);

    expect(handlers.onActivated).toHaveBeenCalledTimes(1);
    expect(handlers.onTimeout).not.toHaveBeenCalled();
  });

  it("times out when nothing takes control and cancels cleanly afterwards", () => {
    vi.useFakeTimers();
    const container = stubServiceWorkerContainer(createWorker("activated"));
    const worker = createWorker("installed");
    const handlers = { onActivated: vi.fn(), onTimeout: vi.fn() };

    const cancel = activateWaitingWorker(worker as unknown as ServiceWorker, handlers, 1_000);
    vi.advanceTimersByTime(1_000);

    expect(handlers.onTimeout).toHaveBeenCalledTimes(1);
    expect(container.removeEventListener).toHaveBeenCalledWith(
      "controllerchange",
      expect.any(Function)
    );

    // A late controller change after the timeout no longer reloads.
    container.dispatch("controllerchange");
    cancel();
    expect(handlers.onActivated).not.toHaveBeenCalled();
  });

  it("cancel drops both the listener and the timer", () => {
    vi.useFakeTimers();
    const container = stubServiceWorkerContainer(createWorker("activated"));
    const worker = createWorker("installed");
    const handlers = { onActivated: vi.fn(), onTimeout: vi.fn() };

    const cancel = activateWaitingWorker(worker as unknown as ServiceWorker, handlers, 1_000);
    cancel();
    container.dispatch("controllerchange");
    vi.advanceTimersByTime(1_000);

    expect(container.listenerCount("controllerchange")).toBe(0);
    expect(handlers.onActivated).not.toHaveBeenCalled();
    expect(handlers.onTimeout).not.toHaveBeenCalled();
  });
});

describe("activateWaitingWorker without a controller change", () => {
  it("reloads once the worker itself reports activated", () => {
    vi.useFakeTimers();
    const container = stubServiceWorkerContainer(createWorker("activated"));
    const worker = createWorker("installed");
    const handlers = { onActivated: vi.fn(), onTimeout: vi.fn() };

    activateWaitingWorker(asWorker(worker), handlers, 1_000);
    expect(worker.listenerCount("statechange")).toBe(1);

    worker.state = "activating";
    worker.dispatch("statechange");
    expect(handlers.onActivated).not.toHaveBeenCalled();

    worker.state = "activated";
    worker.dispatch("statechange");
    vi.advanceTimersByTime(1_000);

    expect(handlers.onActivated).toHaveBeenCalledTimes(1);
    expect(handlers.onTimeout).not.toHaveBeenCalled();
    expect(worker.listenerCount("statechange")).toBe(0);
    expect(container.listenerCount("controllerchange")).toBe(0);
  });

  it("settles at once for a worker that has already activated", () => {
    stubServiceWorkerContainer(createWorker("activated"));
    const worker = createWorker("activated");
    const handlers = { onActivated: vi.fn(), onTimeout: vi.fn() };

    activateWaitingWorker(asWorker(worker), handlers, 1_000);

    expect(handlers.onActivated).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).not.toHaveBeenCalled();
  });
});

describe("update applied flag", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("clears the stored flag on first read and stays true for the rest of the load", () => {
    expect(consumeUpdateApplied()).toBe(false);
    markUpdateApplied();
    expect(sessionStorage.getItem("gg-update-applied")).toBe("1");
    expect(consumeUpdateApplied()).toBe(true);
    expect(sessionStorage.getItem("gg-update-applied")).toBeNull();
    expect(consumeUpdateApplied()).toBe(true);
  });
});
