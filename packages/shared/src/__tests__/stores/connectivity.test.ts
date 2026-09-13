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
  expect(connectivityStore.getStatusSnapshot().state).toBe("checking");
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

it("bounds hanging probes to two three-second attempts and rechecks unavailable connections", async () => {
  vi.useFakeTimers();
  const request = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", request);
  stop = connectivityStore.configureProbe("/connectivity-check.txt");
  await vi.advanceTimersByTimeAsync(6_000);
  expect(request).toHaveBeenCalledTimes(2);
  expect(connectivityStore.getStatusSnapshot().state).toBe("unavailable");
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
