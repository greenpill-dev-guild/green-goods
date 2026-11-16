import { act, renderHook } from "@testing-library/react";
import { createIntl } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSubmitWorkMediaController } from "../../../hooks/admin-ui/garden/useSubmitWorkMediaController";
import messages from "../../../i18n/en.json";

// Container rewriting is tested separately. Keep its output deterministic here
// while exercising the real attachment intake and the Hub's staging decision.
vi.mock("../../../modules/media/video-metadata", () => ({
  withoutVideoMetadata: async (file: File) => file,
}));
vi.mock("../../../modules/media/image-metadata", () => ({
  withoutPhotoMetadata: async (file: File) => file,
}));
vi.mock("../../../utils/work/image-compression", () => ({
  imageCompressor: { shouldCompress: () => false },
}));

const intl = createIntl({ locale: "en", messages });
const media = (name: string, type: string) => new File(["evidence"], name, { type });
let duration = 30;

beforeEach(() => {
  duration = 30;
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag, options) => {
    if (tag !== "video") return createElement(tag, options);
    const video = {
      duration,
      onloadedmetadata: null as (() => void) | null,
      onerror: null,
      removeAttribute: vi.fn(),
      set src(_url: string) {
        queueMicrotask(() => video.onloadedmetadata?.());
      },
    };
    return video as unknown as HTMLVideoElement;
  });
});

afterEach(() => vi.restoreAllMocks());

describe("useSubmitWorkMediaController", () => {
  it.each([
    "video/mp4",
    "video/webm",
  ])("keeps a supported 30-second %s clip beside a photo", async (type) => {
    const { result } = renderHook(() => useSubmitWorkMediaController("action", intl.formatMessage));
    await act(() =>
      result.current.handleFilesChange([
        media("before.jpg", "image/jpeg"),
        media("walkthrough", type),
      ])
    );

    expect(result.current.images.map((file) => file.type)).toEqual(["image/jpeg", type]);
    expect(result.current.mediaFeedback).toBeNull();
  });

  it("refuses an overlong clip while keeping the photo from the same pick", async () => {
    duration = 30.001;
    const { result } = renderHook(() => useSubmitWorkMediaController("action", intl.formatMessage));
    await act(() =>
      result.current.handleFilesChange([
        media("before.jpg", "image/jpeg"),
        media("long.mp4", "video/mp4"),
      ])
    );

    expect(result.current.images.map((file) => file.name)).toEqual(["before.jpg"]);
    expect(result.current.mediaFeedback?.message).toContain("30 seconds");
  });

  it("refuses an oversized video before reading its bytes", async () => {
    const file = media("large.mp4", "video/mp4");
    Object.defineProperty(file, "size", { value: 20 * 1024 * 1024 + 1 });
    const read = vi.spyOn(file, "arrayBuffer");
    const { result } = renderHook(() => useSubmitWorkMediaController("action", intl.formatMessage));
    await act(() => result.current.handleFilesChange([file]));

    expect(read).not.toHaveBeenCalled();
    expect(result.current.images).toEqual([]);
    expect(result.current.mediaFeedback?.message).toContain("20 MB");
  });

  it.each([
    "video/quicktime",
    "audio/webm",
    "application/pdf",
  ])("keeps unsupported %s out of the Hub's staged media", async (type) => {
    const file = new File(["%PDF-1.7"], "extra", { type });
    const { result } = renderHook(() => useSubmitWorkMediaController("action", intl.formatMessage));
    await act(() => result.current.handleFilesChange([file]));

    expect(result.current.images).toEqual([]);
    expect(result.current.mediaFeedback).not.toBeNull();
  });
});
