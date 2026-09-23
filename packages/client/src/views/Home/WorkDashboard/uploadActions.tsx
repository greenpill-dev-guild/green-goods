import type {
  SheetAction,
  SheetActionsProps,
} from "@green-goods/shared/components/Dialog/SheetActions";
import { RiUploadCloud2Line } from "@remixicon/react";
import type { IntlShape } from "react-intl";

/** What the Upload all bar reads about the person's queued work and decisions. */
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

/**
 * The Pending tab's compact upload actions for queued work and decisions.
 * Upload all appears once something can go, and names only the prepared
 * items while the rest are still preparing. Under Data Saver it offers to
 * prepare anyway. Upload all is never offered until there is something ready
 * to sign; the remaining items keep their preparation action.
 */
export function buildUploadActions(
  state: UploadBarState,
  { onUpload, onPrepareNow }: UploadBarHandlers,
  formatMessage: IntlShape["formatMessage"]
): SheetActionsProps | undefined {
  const upload = (count: number, everything: boolean): SheetAction => ({
    label: formatMessage(
      everything
        ? { id: "app.uploads.uploadAll", defaultMessage: "Upload all ({count})" }
        : { id: "app.uploads.uploadReady", defaultMessage: "Upload {count} ready" },
      { count }
    ),
    icon: <RiUploadCloud2Line aria-hidden="true" />,
    onClick: onUpload,
    testId: "upload-all",
  });
  const prepareNow: SheetAction = {
    label: formatMessage({ id: "app.uploads.prepareNow", defaultMessage: "Prepare now" }),
    onClick: onPrepareNow,
    testId: "prepare-uploads",
  };

  if (state.isUploading) {
    return {
      primary: {
        label: formatMessage({ id: "app.uploads.uploading", defaultMessage: "Uploading…" }),
        loading: true,
        testId: "upload-all",
      },
    };
  }
  if (state.readyCount > 0) {
    return {
      primary: upload(state.readyCount, state.preparingCount === 0),
      secondary: state.pausedForDataSaver && state.preparingCount > 0 ? prepareNow : undefined,
    };
  }
  if (state.preparingCount === 0) return undefined;
  if (state.pausedForDataSaver) return { primary: prepareNow };
  if (state.isPreparing) {
    return {
      primary: {
        label: formatMessage({
          id: "app.uploads.preparing",
          defaultMessage: "Preparing uploads…",
        }),
        loading: true,
        testId: "upload-all",
      },
    };
  }
  return { primary: prepareNow };
}
