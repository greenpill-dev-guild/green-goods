import en from "@green-goods/shared/i18n/en";
import { createIntl } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import {
  buildUploadAction,
  type UploadBarState,
} from "../../views/Home/WorkDashboard/uploadActions";

const intl = createIntl({ locale: "en", messages: en });

function header(state: Partial<UploadBarState>) {
  const handlers = { onUpload: vi.fn(), onPrepareNow: vi.fn() };
  const action = buildUploadAction(
    {
      readyCount: 0,
      preparingCount: 0,
      pausedForDataSaver: false,
      isPreparing: false,
      isUploading: false,
      ...state,
    },
    handlers,
    intl.formatMessage
  );
  return { action, handlers };
}

describe("buildUploadAction", () => {
  it("uploads everything once every waiting item is prepared", () => {
    const { action, handlers } = header({ readyCount: 3 });

    expect(action).toMatchObject({ label: "Upload all", testId: "upload-all" });
    action?.onClick?.();
    expect(handlers.onUpload).toHaveBeenCalledOnce();
  });

  it("names only the prepared items while the rest are still preparing", () => {
    const { action } = header({ readyCount: 2, preparingCount: 1, isPreparing: true });

    expect(action).toMatchObject({ label: "Upload 2 ready", testId: "upload-all" });
    expect(action?.loading).toBeUndefined();
  });

  it("sends what is ready under Data Saver, and offers Prepare now once nothing is", () => {
    expect(
      header({ readyCount: 1, preparingCount: 2, pausedForDataSaver: true }).action
    ).toMatchObject({ label: "Upload 1 ready", testId: "upload-all" });

    const { action, handlers } = header({ preparingCount: 2, pausedForDataSaver: true });
    expect(action).toMatchObject({ label: "Prepare now", testId: "prepare-uploads" });
    action?.onClick?.();
    expect(handlers.onPrepareNow).toHaveBeenCalledOnce();
  });

  it("keeps the Upload all label, busy, while nothing is ready yet", () => {
    const { action } = header({ preparingCount: 2, isPreparing: true });

    expect(action).toMatchObject({ label: "Upload all", loading: true, testId: "upload-all" });
    expect(action?.onClick).toBeUndefined();
  });

  it("offers Prepare now instead of Upload all while preparation is not running", () => {
    const { action, handlers } = header({ preparingCount: 2 });

    expect(action).toMatchObject({ label: "Prepare now", testId: "prepare-uploads" });
    expect(action?.loading).toBeUndefined();
    action?.onClick?.();
    expect(handlers.onPrepareNow).toHaveBeenCalledOnce();
    expect(handlers.onUpload).not.toHaveBeenCalled();
  });

  it("holds its uploading state until the upload settles", () => {
    const { action } = header({ readyCount: 0, isUploading: true });

    expect(action).toMatchObject({ label: "Uploading…", loading: true, testId: "upload-all" });
  });

  it("offers nothing when nothing can upload", () => {
    expect(header({}).action).toBeUndefined();
  });
});
