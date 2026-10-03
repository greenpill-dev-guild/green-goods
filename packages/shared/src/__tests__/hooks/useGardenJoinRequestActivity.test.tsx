import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGardenJoinRequestActivity } from "../../hooks/garden/useGardenJoinRequestActivity";

describe("join request presentation activity", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("dispatches immediately and keeps a fast result readable for 600ms", async () => {
    const operation = vi.fn(async () => "saved");
    const { result } = renderHook(() => useGardenJoinRequestActivity("a"));
    let response!: ReturnType<typeof result.current.run<string>>;
    await act(async () => {
      response = result.current.run("checking", operation);
    });
    expect(operation).toHaveBeenCalledOnce();
    expect(result.current.activity).toBe("checking");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(599);
    });
    expect(result.current.activity).toBe("checking");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(await response).toEqual({ value: "saved" });
    expect(result.current.activity).toBeNull();
  });

  it("keeps progress for the whole slow operation and rejects duplicate activation", async () => {
    let resolve!: (value: boolean) => void;
    const operation = vi.fn(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        })
    );
    const { result } = renderHook(() => useGardenJoinRequestActivity("a"));
    let response!: ReturnType<typeof result.current.run<boolean>>;
    await act(async () => {
      response = result.current.run("withdrawing", operation);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.activity).toBe("withdrawing");
    expect(await result.current.run("sending", operation)).toBeNull();
    expect(operation).toHaveBeenCalledOnce();
    await act(async () => {
      resolve(true);
      await response;
    });
    expect(await response).toEqual({ value: true });
    expect(result.current.activity).toBeNull();
  });

  it("shows failures after readable progress without swallowing the error", async () => {
    const failure = new Error("offline");
    const { result } = renderHook(() => useGardenJoinRequestActivity("a"));
    let response!: ReturnType<typeof result.current.run>;
    await act(async () => {
      response = result.current.run("checking", async () => {
        throw failure;
      });
    });
    const rejected = expect(response).rejects.toBe(failure);
    expect(result.current.activity).toBe("checking");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    await rejected;
    expect(result.current.activity).toBeNull();
  });

  it("invalidates old feedback through a→b→a and releases its timer", async () => {
    let resolve!: (value: boolean) => void;
    const { result, rerender } = renderHook(({ scope }) => useGardenJoinRequestActivity(scope), {
      initialProps: { scope: "a" },
    });
    let response!: ReturnType<typeof result.current.run<boolean>>;
    await act(async () => {
      response = result.current.run(
        "sending",
        () =>
          new Promise<boolean>((done) => {
            resolve = done;
          })
      );
    });
    rerender({ scope: "b" });
    rerender({ scope: "a" });
    expect(result.current.activity).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => {
      resolve(true);
      await response;
    });
    expect(await response).toBeNull();
  });

  it("clears the presentation timer on unmount without canceling persistence", async () => {
    let resolve!: (value: boolean) => void;
    const { result, unmount } = renderHook(() => useGardenJoinRequestActivity("a"));
    let response!: ReturnType<typeof result.current.run<boolean>>;
    await act(async () => {
      response = result.current.run(
        "sending",
        () =>
          new Promise<boolean>((done) => {
            resolve = done;
          })
      );
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    resolve(true);
    expect(await response).toBeNull();
  });
});
