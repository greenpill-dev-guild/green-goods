import { RiUploadCloud2Line } from "@remixicon/react";
import type { ReactNode } from "react";
import type { IntlShape } from "react-intl";

/** What the Upload all action reads about the person's queued work and decisions. */
export interface UploadBarState {
  /** Prepared items Upload all sends. */
  readyCount: number;
  /** Items still being prepared, photos waiting to convert included. */
  preparingCount: number;
  /** Background preparation waits for Data Saver until the person asks. */
  pausedForDataSaver: boolean;
  /** Preparation is running, or about to, rather than waiting for the connection. */
  isPreparing: boolean;
  isUploading: boolean;
}

export interface UploadBarHandlers {
  onUpload: () => void;
  onPrepareNow: () => void;
}

/** The one upload action in the Pending header. */
export interface UploadAction {
  label: string;
  icon?: ReactNode;
  /** In flight: shows the spinner and ignores taps. */
  loading?: boolean;
  onClick?: () => void;
  testId: "upload-all" | "prepare-uploads";
}

/**
 * The Pending header's upload action for queued work and decisions. It is one
 * compact button beside the item count, so it never takes a second row. Upload
 * all appears once something can go, and names only the prepared items while
 * the rest are still preparing. Before anything is ready it shows Upload all
 * with a spinner, and that label carries no count, so the button keeps one
 * width while the work turns ready, at any count. Under Data Saver it offers
 * Prepare now once nothing is ready to go; each work's own page offers it for
 * that work.
 */
export function buildUploadAction(
  state: UploadBarState,
  { onUpload, onPrepareNow }: UploadBarHandlers,
  formatMessage: IntlShape["formatMessage"]
): UploadAction | undefined {
  const icon = <RiUploadCloud2Line className="h-4 w-4" aria-hidden="true" />;
  const uploadAll = formatMessage({ id: "app.uploads.uploadAll", defaultMessage: "Upload all" });
  const prepareNow: UploadAction = {
    label: formatMessage({ id: "app.uploads.prepareNow", defaultMessage: "Prepare now" }),
    onClick: onPrepareNow,
    testId: "prepare-uploads",
  };

  if (state.isUploading) {
    return {
      label: formatMessage({ id: "app.uploads.uploading", defaultMessage: "Uploading…" }),
      loading: true,
      testId: "upload-all",
    };
  }
  if (state.readyCount > 0) {
    return {
      label:
        state.preparingCount === 0
          ? uploadAll
          : formatMessage(
              { id: "app.uploads.uploadReady", defaultMessage: "Upload {count} ready" },
              { count: state.readyCount }
            ),
      icon,
      onClick: onUpload,
      testId: "upload-all",
    };
  }
  if (state.preparingCount === 0) return undefined;
  if (state.pausedForDataSaver) return prepareNow;
  if (state.isPreparing) {
    return { label: uploadAll, icon, loading: true, testId: "upload-all" };
  }
  return prepareNow;
}
