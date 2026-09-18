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
  observeUpdateAttempt,
  resolveUpdateTarget,
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
  it("distinguishes an obsolete target from the registration's live workers", () => {
    const controller = asWorker(createWorker("activated", "/sw.js"));
    stubServiceWorkerContainer(controller);
    const target = asWorker(createWorker("redundant", "/sw.js"));
    const registration = {
      active: controller,
      waiting: asWorker(createWorker("installed", "/sw.js")),
      installing: null,
    } as ServiceWorkerRegistration;
    expect(buildUpdateTelemetry(target, {}, registration)).toMatchObject({
      controller_state: "activated",
      target_worker_state: "redundant",
      registration_present: true,
      registered_active_worker_state: "activated",
      registered_waiting_worker_state: "installed",
      registered_installing_worker_state: "none",
      target_is_registered_waiting: false,
      target_is_registered_active: false,
      target_is_controller: false,
      active_worker_version: "unknown",
      waiting_worker_version: "unknown",
    });
    expect(buildUpdateTelemetry(controller, {}, registration)).toMatchObject({
      target_is_registered_active: true,
      target_is_controller: true,
    });
  });

  it("reports a missing registration and controller without inventing worker state", () => {
    stubServiceWorkerContainer(null);
    expect(buildUpdateTelemetry(null, {}, null)).toMatchObject({
      registration_present: false,
      controller_state: "none",
      target_worker_state: "none",
      target_is_controller: false,
      target_is_registered_waiting: false,
    });
  });

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
  it("quiets the active worker before asking the waiting worker to activate", async () => {
    vi.useFakeTimers();
    const active = createWorker("activated");
    const container = stubServiceWorkerContainer(active);
    const worker = createWorker("installed");
    const handlers = { onActivated: vi.fn(), onTimeout: vi.fn() };

    activateWaitingWorker(worker as unknown as ServiceWorker, handlers, 1_000);

    expect(container.addEventListener).toHaveBeenCalledWith(
      "controllerchange",
      expect.any(Function)
    );
    expect(active.postMessage).toHaveBeenCalledWith(
      { type: "PREPARE_TO_ACTIVATE_UPDATE" },
      expect.any(Array)
    );
    expect(worker.postMessage).not.toHaveBeenCalled();
    const quietPort = active.postMessage.mock.calls[0][1][0] as MessagePort;
    quietPort.postMessage({ type: "GG_QUIET_ACK", status: "quiet" });
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalled());
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    container.controller = asWorker(worker);
    container.dispatch("controllerchange");
    vi.advanceTimersByTime(1_000);

    expect(handlers.onActivated).toHaveBeenCalledTimes(1);
    expect(handlers.onTimeout).not.toHaveBeenCalled();
  });

  it("hands on what the active worker reports it had open when it went quiet", async () => {
    vi.useFakeTimers();
    const active = createWorker("activated");
    stubServiceWorkerContainer(active);
    const worker = createWorker("installed");
    const handlers = { onActivated: vi.fn(), onTimeout: vi.fn(), onProgress: vi.fn() };
    const report = { trackedWork: 1, cancelledFetches: 2, pendingResponses: { image: 1 } };

    activateWaitingWorker(asWorker(worker), handlers, 1_000);
    const quietPort = active.postMessage.mock.calls[0][1][0] as MessagePort;
    quietPort.postMessage({ type: "GG_QUIET_ACK", status: "quiet", report });

    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalled());
    expect(handlers.onProgress).toHaveBeenCalledWith("quiet", report);
  });

  it("goes ahead on a quiet ack whose report is missing or not the shape expected", async () => {
    vi.useFakeTimers();
    for (const report of [undefined, { trackedWork: "1" }, null]) {
      const active = createWorker("activated");
      stubServiceWorkerContainer(active);
      const worker = createWorker("installed");
      const handlers = { onActivated: vi.fn(), onTimeout: vi.fn(), onProgress: vi.fn() };

      const cancel = activateWaitingWorker(asWorker(worker), handlers, 1_000);
      const quietPort = active.postMessage.mock.calls[0][1][0] as MessagePort;
      quietPort.postMessage({ type: "GG_QUIET_ACK", status: "quiet", report });

      await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalled());
      // An older worker sends no report: the hand-over is unchanged for it.
      expect(handlers.onProgress).toHaveBeenCalledWith("quiet");
      cancel();
    }
  });

  it("keeps the update waiting when the active worker cannot acknowledge quiescence", () => {
    vi.useFakeTimers();
    const active = createWorker("activated");
    stubServiceWorkerContainer(active);
    const worker = createWorker("installed");
    const handlers = { onActivated: vi.fn(), onTimeout: vi.fn(), onProgress: vi.fn() };

    activateWaitingWorker(asWorker(worker), handlers, 1_000);
    vi.advanceTimersByTime(1_000);

    expect(active.postMessage).toHaveBeenCalledWith(
      { type: "PREPARE_TO_ACTIVATE_UPDATE" },
      expect.any(Array)
    );
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(handlers.onProgress).toHaveBeenCalledWith("quieting");
    expect(handlers.onTimeout).toHaveBeenCalledOnce();
    expect(active.postMessage).toHaveBeenLastCalledWith({ type: "RESUME_BACKGROUND_WORK" });
  });

  it("times out when nothing takes control and cancels cleanly afterwards", () => {
    vi.useFakeTimers();
    const container = stubServiceWorkerContainer(null);
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
  it("settles once the worker reaches activated, even without a controller change", () => {
    vi.useFakeTimers();
    const active = createWorker("activated");
    const container = stubServiceWorkerContainer(active);
    const worker = createWorker("installed");
    const handlers = { onActivated: vi.fn(), onTimeout: vi.fn() };

    activateWaitingWorker(asWorker(worker), handlers, 1_000);
    expect(worker.listenerCount("statechange")).toBe(1);

    worker.state = "activating";
    worker.dispatch("statechange");
    expect(handlers.onActivated).not.toHaveBeenCalled();

    // The page stays controlled by the old worker: nothing claims it. The
    // reload after activation is a navigation the new worker serves anyway.
    worker.state = "activated";
    worker.dispatch("statechange");
    vi.advanceTimersByTime(1_000);

    expect(handlers.onActivated).toHaveBeenCalledOnce();
    expect(handlers.onTimeout).not.toHaveBeenCalled();
    expect(active.postMessage).not.toHaveBeenCalledWith({ type: "RESUME_BACKGROUND_WORK" });
    expect(worker.listenerCount("statechange")).toBe(0);
    expect(container.listenerCount("controllerchange")).toBe(0);
  });

  it("settles at once for a worker that has already activated", () => {
    const worker = createWorker("activated");
    stubServiceWorkerContainer(worker);
    const handlers = { onActivated: vi.fn(), onTimeout: vi.fn() };

    activateWaitingWorker(asWorker(worker), handlers, 1_000);

    expect(handlers.onActivated).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).not.toHaveBeenCalled();
  });
});

describe("observeUpdateAttempt", () => {
  it("flags an activation only when it lands after the attempt timed out", () => {
    stubServiceWorkerContainer(createWorker("activated"));
    const onTime = createWorker("installed");
    const seenOnTime = vi.fn();
    observeUpdateAttempt(asWorker(onTime), () => null, seenOnTime);
    onTime.state = "activated";
    onTime.dispatch("statechange");
    expect(seenOnTime).toHaveBeenCalledWith(
      expect.objectContaining({ after_timeout: false, target_worker_state: "activated" }),
      undefined
    );

    const late = createWorker("installed");
    const seenLate = vi.fn();
    const attempt = observeUpdateAttempt(asWorker(late), () => null, seenLate);
    attempt.markTimedOut();
    late.state = "activating";
    late.dispatch("statechange");
    expect(seenLate).toHaveBeenLastCalledWith(
      expect.objectContaining({ after_timeout: true, target_worker_state: "activating" }),
      undefined
    );
    late.state = "activated";
    late.dispatch("statechange");
    expect(seenLate).toHaveBeenLastCalledWith(
      expect.objectContaining({ after_timeout: true, target_worker_state: "activated" }),
      { elapsedMs: expect.any(Number) }
    );
    // Settled: the observer lets go of the worker by itself.
    expect(late.listenerCount("statechange")).toBe(0);
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

describe("update retry target", () => {
  it("rejects obsolete references and follows the live replacement or already active target", () => {
    const obsolete = asWorker(createWorker("redundant"));
    const replacement = asWorker(createWorker("installed"));
    const active = asWorker(createWorker("activated"));
    const registration = { waiting: null, active } as unknown as ServiceWorkerRegistration;
    expect(resolveUpdateTarget(registration, obsolete)).toBeNull();
    expect(resolveUpdateTarget(registration, active)).toBe(active);
    expect(resolveUpdateTarget({ ...registration, waiting: replacement }, obsolete)).toBe(
      replacement
    );
  });
});

describe("activation acknowledgment", () => {
  it("does not mistake acknowledgment or an unrelated controller change for activation", () => {
    vi.useFakeTimers();
    const container = stubServiceWorkerContainer(null);
    const worker = createWorker("installed");
    const port1 = {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      close: vi.fn(),
    };
    const port2 = { close: vi.fn() };
    vi.stubGlobal(
      "MessageChannel",
      class {
        port1 = port1;
        port2 = port2;
      }
    );
    const handlers = { onActivated: vi.fn(), onTimeout: vi.fn(), onProgress: vi.fn() };
    try {
      activateWaitingWorker(asWorker(worker), handlers, 1000);
      port1.onmessage?.({ data: { type: "GG_UPDATE_ACK", status: "requested" } });
      expect(handlers.onProgress).toHaveBeenCalledWith("requested");
      container.dispatch("controllerchange");
      expect(handlers.onActivated).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(handlers.onTimeout).toHaveBeenCalledOnce();
      expect(port1.close).toHaveBeenCalledOnce();
      worker.state = "activated";
      worker.dispatch("statechange");
      expect(handlers.onActivated).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
