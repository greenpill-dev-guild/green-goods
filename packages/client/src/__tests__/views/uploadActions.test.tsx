import en from "@green-goods/shared/i18n/en";
import { createIntl } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import {
  buildUploadActions,
  type UploadBarState,
} from "../../views/Home/WorkDashboard/uploadActions";

const intl = createIntl({ locale: "en", messages: en });

function bar(state: Partial<UploadBarState>) {
  const handlers = { onUpload: vi.fn(), onPrepareNow: vi.fn() };
  const actions = buildUploadActions(
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
  return { actions, handlers };
}

describe("buildUploadActions", () => {
  it("uploads everything once every waiting item is prepared", () => {
    const { actions, handlers } = bar({ readyCount: 3 });

    expect(actions?.primary).toMatchObject({ label: "Upload all (3)", testId: "upload-all" });
    expect(actions?.secondary).toBeUndefined();
    actions?.primary?.onClick?.({} as never);
    expect(handlers.onUpload).toHaveBeenCalledOnce();
  });

  it("names only the prepared items while the rest are still preparing", () => {
    const { actions } = bar({ readyCount: 2, preparingCount: 1, isPreparing: true });

    expect(actions?.primary).toMatchObject({ label: "Upload 2 ready", testId: "upload-all" });
    expect(actions?.primary?.loading).toBeUndefined();
  });

  it("offers to prepare the rest under Data Saver beside what is ready", () => {
    const { actions, handlers } = bar({
      readyCount: 1,
      preparingCount: 2,
      pausedForDataSaver: true,
    });

    expect(actions?.primary?.label).toBe("Upload 1 ready");
    expect(actions?.secondary).toMatchObject({ label: "Prepare now", testId: "prepare-uploads" });
    actions?.secondary?.onClick?.({} as never);
    expect(handlers.onPrepareNow).toHaveBeenCalledOnce();
  });

  it("offers Prepare now when Data Saver holds back everything", () => {
    const { actions } = bar({ preparingCount: 2, pausedForDataSaver: true });

    expect(actions?.primary).toMatchObject({ label: "Prepare now", testId: "prepare-uploads" });
    expect(actions?.secondary).toBeUndefined();
  });

  it("shows preparation in progress when nothing is ready yet", () => {
    const { actions } = bar({ preparingCount: 2, isPreparing: true });

    expect(actions?.primary).toMatchObject({
      label: "Preparing uploads…",
      loading: true,
      testId: "upload-all",
    });
    expect(actions?.primary?.onClick).toBeUndefined();
  });

  it("keeps Upload all tappable while preparation waits for the connection, without saying so", () => {
    const { actions, handlers } = bar({ preparingCount: 2 });

    expect(actions?.primary).toMatchObject({ label: "Upload all (2)", testId: "upload-all" });
    expect(actions?.primary?.loading).toBeUndefined();
    actions?.primary?.onClick?.({} as never);
    expect(handlers.onUpload).toHaveBeenCalledOnce();
  });

  it("holds the bar in its uploading state until the upload settles", () => {
    const { actions } = bar({ readyCount: 0, isUploading: true });

    expect(actions?.primary).toMatchObject({
      label: "Uploading…",
      loading: true,
      testId: "upload-all",
    });
  });

  it("shows no bar when nothing can upload", () => {
    expect(bar({}).actions).toBeUndefined();
  });
});
