/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  convertHeicPhoto: vi.fn(),
  tierListeners: new Set<(status: string) => void>(),
  statusListeners: new Set<() => void>(),
}));
vi.mock("../../../modules/work/heic-conversion", () => ({
  convertHeicPhoto: env.convertHeicPhoto,
}));
vi.mock("../../../modules/app/service-worker-registration", () => ({
  observePwaShellTier: (_tier: string, listener: (status: string) => void) => {
    env.tierListeners.add(listener);
    return () => env.tierListeners.delete(listener);
  },
}));
vi.mock("../../../stores/connectivity", () => ({
  connectivityStore: {
    subscribeStatus: (listener: () => void) => {
      env.statusListeners.add(listener);
      return () => env.statusListeners.delete(listener);
    },
  },
}));

import { useDeferredHeicConversion } from "../../../hooks/work/useDeferredHeicConversion";
import { getWorkMediaId } from "../../../modules/work/media-processing";

const heic = () => new File(["heic"], "garden.heic", { type: "image/heic" });
const jpeg = (name = "garden.jpg") => new File(["jpeg"], name, { type: "image/jpeg" });

function renderConversion(initial: File[]) {
  let files = initial;
  const replace = vi.fn((mediaId: string, converted: File) => {
    files = files.map((file) => (getWorkMediaId(file) === mediaId ? converted : file));
    view.rerender();
  });
  const view = renderHook(() => useDeferredHeicConversion({ files, replace }));
  return { ...view, replace, files: () => files };
}

beforeEach(() => {
  env.convertHeicPhoto.mockReset();
  env.tierListeners.clear();
  env.statusListeners.clear();
});

describe("converting a composer's waiting HEIC photos", () => {
  it("does nothing when no photo is waiting", async () => {
    renderConversion([jpeg()]);
    await act(async () => {});
    expect(env.convertHeicPhoto).not.toHaveBeenCalled();
    expect(env.tierListeners.size).toBe(0);
  });

  it("replaces a waiting photo in place once the offline-ready tier reports ready", async () => {
    const waiting = heic();
    const converted = jpeg();
    env.convertHeicPhoto.mockResolvedValueOnce({ status: "unavailable" });
    const view = renderConversion([jpeg("first.jpg"), waiting]);
    await waitFor(() => expect(view.result.current.stateOf(waiting)).toBe("waiting"));
    expect(env.convertHeicPhoto).toHaveBeenCalledTimes(1);

    env.convertHeicPhoto.mockResolvedValueOnce({ status: "converted", file: converted });
    await act(async () => {
      env.tierListeners.forEach((listener) => listener("ready"));
    });

    await waitFor(() =>
      expect(view.replace).toHaveBeenCalledWith(getWorkMediaId(waiting), converted)
    );
    expect(view.files().map((file) => file.name)).toEqual(["first.jpg", "garden.jpg"]);
  });

  it("converts every waiting photo even though each swap re-renders the composer", async () => {
    const first = heic();
    const second = new File(["heic-2"], "second.heic", { type: "image/heic" });
    env.convertHeicPhoto
      .mockResolvedValueOnce({ status: "converted", file: jpeg("first.jpg") })
      .mockResolvedValueOnce({ status: "converted", file: jpeg("second.jpg") });
    const view = renderConversion([first, second]);

    await waitFor(() => expect(view.replace).toHaveBeenCalledTimes(2));
    expect(view.files().map((file) => file.name)).toEqual(["first.jpg", "second.jpg"]);
  });

  it("tries again when the connection changes", async () => {
    env.convertHeicPhoto.mockResolvedValue({ status: "unavailable" });
    renderConversion([heic()]);
    await waitFor(() => expect(env.convertHeicPhoto).toHaveBeenCalledTimes(1));

    await act(async () => {
      env.statusListeners.forEach((listener) => listener());
    });

    await waitFor(() => expect(env.convertHeicPhoto).toHaveBeenCalledTimes(2));
  });

  it("marks a photo that will not decode as failed, and tries it again only when asked", async () => {
    const waiting = heic();
    env.convertHeicPhoto.mockResolvedValue({ status: "failed", error: new Error("bad file") });
    const view = renderConversion([waiting]);
    await waitFor(() => expect(view.result.current.stateOf(waiting)).toBe("failed"));

    await act(async () => {
      env.statusListeners.forEach((listener) => listener());
    });
    expect(env.convertHeicPhoto).toHaveBeenCalledTimes(1);

    env.convertHeicPhoto.mockResolvedValueOnce({ status: "converted", file: jpeg() });
    await act(async () => {
      view.result.current.retry(waiting);
    });

    await waitFor(() => expect(view.replace).toHaveBeenCalledOnce());
  });
});
