/** @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrCreateUrl: vi.fn((file: File) => `blob:draft-${file.name}`),
  cleanupFile: vi.fn(),
}));

vi.mock("../../../modules/job-queue/media-resource-manager", () => ({
  mediaResourceManager: {
    getOrCreateUrl: mocks.getOrCreateUrl,
    cleanupFile: mocks.cleanupFile,
  },
}));

import { useProfileAvatarDraftPreview } from "../../../hooks/profile/useProfileAvatarDraftPreview";

describe("useProfileAvatarDraftPreview", () => {
  beforeEach(() => {
    mocks.getOrCreateUrl.mockClear();
    mocks.cleanupFile.mockClear();
  });

  it("creates the preview URL after commit and releases it with the file", () => {
    const first = new File(["a"], "first.png", { type: "image/png" });
    const second = new File(["b"], "second.png", { type: "image/png" });

    const { result, rerender, unmount } = renderHook(
      ({ file }: { file: File | null }) => useProfileAvatarDraftPreview(file),
      { initialProps: { file: first as File | null } }
    );
    expect(result.current).toBe("blob:draft-first.png");
    expect(mocks.getOrCreateUrl).toHaveBeenCalledTimes(1);

    rerender({ file: second });
    expect(mocks.cleanupFile).toHaveBeenCalledWith(first);
    expect(result.current).toBe("blob:draft-second.png");

    rerender({ file: null });
    expect(mocks.cleanupFile).toHaveBeenCalledWith(second);
    expect(result.current).toBeNull();

    unmount();
    expect(mocks.getOrCreateUrl).toHaveBeenCalledTimes(2);
  });
});
