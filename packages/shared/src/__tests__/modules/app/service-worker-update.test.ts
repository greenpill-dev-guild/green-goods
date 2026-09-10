/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WAITING_WORKER_TIMEOUT_MS,
  waitForWaitingWorker,
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

function createWorker(state: ServiceWorkerState) {
  return createTarget({ state });
}

function createRegistration(
  overrides: { waiting?: ServiceWorker | null; installing?: ServiceWorker | null } = {}
) {
  return createTarget({ waiting: null, installing: null, ...overrides });
}

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

function stubController() {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { controller: createWorker("activated") },
  });
}

afterEach(() => {
  vi.useRealTimers();
  if (originalServiceWorker) {
    Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
  } else {
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
});

describe("waitForWaitingWorker", () => {
  it("returns a worker that is already waiting without listening", async () => {
    const waiting = createWorker("installed");
    const registration = createRegistration({ waiting: waiting as unknown as ServiceWorker });
    const onInstalling = vi.fn();

    await expect(
      waitForWaitingWorker(registration as unknown as ServiceWorkerRegistration, onInstalling)
    ).resolves.toBe(waiting);

    expect(registration.addEventListener).not.toHaveBeenCalled();
    expect(onInstalling).not.toHaveBeenCalled();
  });

  it("resolves once the worker found by the check reaches installed", async () => {
    stubController();
    const installing = createWorker("installing");
    const registration = createRegistration({ installing: installing as unknown as ServiceWorker });
    const onInstalling = vi.fn();

    const settled = waitForWaitingWorker(
      registration as unknown as ServiceWorkerRegistration,
      onInstalling
    );
    expect(installing.listenerCount("statechange")).toBe(1);

    installing.state = "installed";
    installing.dispatch("statechange");

    await expect(settled).resolves.toBe(installing);
    // The check already saw this worker installing, so there is no new download to report.
    expect(onInstalling).not.toHaveBeenCalled();
    expect(installing.listenerCount("statechange")).toBe(0);
    expect(registration.listenerCount("updatefound")).toBe(0);
  });

  it("reports a worker that starts installing during the wait, then returns it", async () => {
    stubController();
    const registration = createRegistration();
    const onInstalling = vi.fn();

    const settled = waitForWaitingWorker(
      registration as unknown as ServiceWorkerRegistration,
      onInstalling
    );
    const installing = createWorker("installing");
    registration.installing = installing as unknown as ServiceWorker;
    registration.dispatch("updatefound");

    expect(onInstalling).toHaveBeenCalledTimes(1);

    installing.state = "installed";
    installing.dispatch("statechange");

    await expect(settled).resolves.toBe(installing);
  });

  it("gives up with null once the timeout passes with nothing installing", async () => {
    vi.useFakeTimers();
    const registration = createRegistration();
    const onInstalling = vi.fn();

    const settled = waitForWaitingWorker(
      registration as unknown as ServiceWorkerRegistration,
      onInstalling
    );
    vi.advanceTimersByTime(WAITING_WORKER_TIMEOUT_MS);

    await expect(settled).resolves.toBeNull();
    expect(onInstalling).not.toHaveBeenCalled();
    expect(registration.listenerCount("updatefound")).toBe(0);
  });
});
