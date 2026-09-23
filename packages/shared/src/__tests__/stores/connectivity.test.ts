/** @vitest-environment jsdom */
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
let connectivityStore: typeof import("../../stores/connectivity")["connectivityStore"];
beforeAll(async () => {
  ({ connectivityStore } = await import("../../stores/connectivity"));
});

let stop: (() => void) | undefined;
const onlineHint = (value: boolean) =>
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
beforeEach(() => {
  onlineHint(true);
  window.dispatchEvent(new Event("online"));
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  onlineHint(true);
  window.dispatchEvent(new Event("online"));
});

it("does not let a late subscriber erase a received offline event with a stale online hint", () => {
  window.dispatchEvent(new Event("offline"));
  expect(connectivityStore.getSnapshot()).toBe(false);
  const unsubscribe = connectivityStore.subscribe(() => {});
  expect(connectivityStore.getSnapshot()).toBe(false);
  unsubscribe();
});

it("observes offline lifecycle changes before any consumer subscribes", () => {
  onlineHint(false);
  window.dispatchEvent(new Event("pageshow"));
  expect(connectivityStore.getStatusSnapshot().state).toBe("offline");
});

it("waits for an uncached origin response before confirming recovery", async () => {
  let resolve: (response: Response) => void = () => {};
  const request = vi.fn(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      })
  );
  vi.stubGlobal("fetch", request);
  window.dispatchEvent(new Event("offline"));
  stop = connectivityStore.configureProbe("/connectivity-check.txt");
  expect(connectivityStore.getStatusSnapshot().state).toBe("offline");
  expect(connectivityStore.getSnapshot()).toBe(false);
  expect(request).toHaveBeenCalledWith(
    expect.stringContaining("/connectivity-check.txt?check="),
    expect.objectContaining({ cache: "no-store" })
  );
  resolve(new Response("ok"));
  await connectivityStore.check();
  expect(connectivityStore.getStatusSnapshot().state).toBe("online");
  expect(connectivityStore.getStatusSnapshot().checkedAt).toBeTypeOf("number");
});

it("does not declare the device offline for an individual HTTP service failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
  stop = connectivityStore.configureProbe("/connectivity-check.txt");
  await connectivityStore.reportNetworkFailure();
  expect(connectivityStore.getStatusSnapshot().state).toBe("online");
});

it("keeps queries online while two failed probes mark the connection degraded", async () => {
  vi.useFakeTimers();
  const request = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", request);
  stop = connectivityStore.configureProbe("/connectivity-check.txt");
  await vi.advanceTimersByTimeAsync(6_000);
  expect(request).toHaveBeenCalledTimes(2);
  expect(connectivityStore.getStatusSnapshot().state).toBe("degraded");
  expect(connectivityStore.getSnapshot()).toBe(true);
  request.mockImplementation(() => Promise.resolve(new Response("ok")));
  await vi.advanceTimersByTimeAsync(30_000);
  expect(connectivityStore.getStatusSnapshot().state).toBe("online");
});

it("keeps a later offline event authoritative over a delayed successful response", async () => {
  let resolve: (response: Response) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        })
    )
  );
  stop = connectivityStore.configureProbe("/connectivity-check.txt");
  window.dispatchEvent(new Event("offline"));
  resolve(new Response("ok"));
  await Promise.resolve();
  await Promise.resolve();
  expect(connectivityStore.getStatusSnapshot().state).toBe("offline");
});

it("does not confirm the connection before the probe has answered", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {}))
  );
  stop = connectivityStore.configureProbe("/connectivity-check.txt");
  // The boot state and the pending-probe state both read "online".
  expect(connectivityStore.getStatusSnapshot().state).toBe("online");
  expect(connectivityStore.isConfirmedOnline()).toBe(false);
});

it("confirms the connection only while the last probe answer is recent", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok")));
  stop = connectivityStore.configureProbe("/connectivity-check.txt");
  await connectivityStore.check();
  const checkedAt = connectivityStore.getStatusSnapshot().checkedAt!;
  expect(connectivityStore.isConfirmedOnline(checkedAt + 60_000)).toBe(true);
  expect(connectivityStore.isConfirmedOnline(checkedAt + 60_001)).toBe(false);
  expect(connectivityStore.isConfirmedOnline(checkedAt + 5_000, 1_000)).toBe(false);
});

it("never confirms an unstable connection", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {}))
  );
  stop = connectivityStore.configureProbe("/connectivity-check.txt");
  await vi.advanceTimersByTimeAsync(6_000);
  expect(connectivityStore.getStatusSnapshot().state).toBe("degraded");
  expect(connectivityStore.isConfirmedOnline()).toBe(false);
});

it("never confirms a device the browser reports offline", () => {
  window.dispatchEvent(new Event("offline"));
  expect(connectivityStore.isConfirmedOnline()).toBe(false);
});

it("uses the browser's signal where no probe is configured", async () => {
  await connectivityStore.check();
  expect(connectivityStore.getStatusSnapshot().checkedAt).toBeUndefined();
  expect(connectivityStore.isConfirmedOnline()).toBe(true);
});

it("re-probes a stale answer before confirming, and refuses when the probe fails", async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockResolvedValue(new Response("ok"));
  vi.stubGlobal("fetch", request);
  stop = connectivityStore.configureProbe("/connectivity-check.txt");
  await connectivityStore.check();
  request.mockClear();
  await expect(connectivityStore.confirmOnline()).resolves.toBe(true);
  expect(request).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(15_001);
  await expect(connectivityStore.confirmOnline()).resolves.toBe(true);
  expect(request).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(15_001);
  request.mockRejectedValue(new TypeError("Failed to fetch"));
  await expect(connectivityStore.confirmOnline()).resolves.toBe(false);
  expect(connectivityStore.getStatusSnapshot().state).toBe("degraded");
});

it("reuses a recent origin answer for background work and re-probes after one minute", async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockResolvedValue(new Response("ok"));
  vi.stubGlobal("fetch", request);
  stop = connectivityStore.configureProbe("/connectivity-check.txt");
  await connectivityStore.check();
  request.mockClear();

  await vi.advanceTimersByTimeAsync(30_000);
  await expect(connectivityStore.confirmForBackgroundWork()).resolves.toBe(true);
  expect(request).not.toHaveBeenCalled();

  await vi.advanceTimersByTimeAsync(30_001);
  await expect(connectivityStore.confirmForBackgroundWork()).resolves.toBe(true);
  expect(request).toHaveBeenCalledOnce();
});

it("leaves a degraded connection to its scheduled recovery instead of probing for background work", async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  vi.stubGlobal("fetch", request);
  stop = connectivityStore.configureProbe("/connectivity-check.txt");
  await connectivityStore.check();
  expect(connectivityStore.getStatusSnapshot().state).toBe("degraded");
  expect(request).toHaveBeenCalledTimes(2);

  await expect(connectivityStore.confirmForBackgroundWork()).resolves.toBe(false);
  expect(request).toHaveBeenCalledTimes(2);
});
