import { toastService } from "../toast.service";
import { type FormatMessageFn, toastMessageIdsUpdate } from "./types";

/** Default (English) fallback messages for app update toasts */
const updateDefaults = {
  checking: {
    title: "Checking for update",
    message: "Looking for a newer version.",
  },
  downloading: {
    title: "Downloading update",
    message: "Getting the latest version in the background.",
  },
  ready: {
    title: "Ready to restart",
    message: "Restart Green Goods to finish updating.",
    action: "Restart to update",
  },
  applying: {
    title: "Finishing update",
    message: "Restarting with the latest version.",
  },
  stalled: {
    title: "Update not finished",
    message: "The update has not finished. Try again, or keep using the app and update later.",
    action: "Try again",
  },
  failed: {
    title: "Update download failed",
    message: "Green Goods could not download the update. Check your connection and try again.",
    action: "Try again",
  },
  applied: {
    title: "Updated",
    message: "Green Goods restarted on the latest version.",
  },
  preparingOffline: {
    title: "Updated",
    message: "Getting it ready to work offline.",
  },
  offlineReady: {
    title: "Ready to work offline",
    message: "You can add work without a signal.",
  },
};

/**
 * Create i18n-aware update toasts
 * @param formatMessage - react-intl formatMessage function
 */
export function createUpdateToasts(formatMessage: FormatMessageFn) {
  const localizedToasts = {
    applied: () =>
      toastService.success({
        id: "app-update",
        title: formatMessage({
          id: toastMessageIdsUpdate.applied.title,
          defaultMessage: updateDefaults.applied.title,
        }),
        message: formatMessage({
          id: toastMessageIdsUpdate.applied.message,
          defaultMessage: updateDefaults.applied.message,
        }),
        context: "app update",
        suppressLogging: true,
      }),

    preparingOffline: () =>
      toastService.loading({
        id: "app-update",
        title: formatMessage({
          id: toastMessageIdsUpdate.preparingOffline.title,
          defaultMessage: updateDefaults.preparingOffline.title,
        }),
        message: formatMessage({
          id: toastMessageIdsUpdate.preparingOffline.message,
          defaultMessage: updateDefaults.preparingOffline.message,
        }),
        context: "app update",
        suppressLogging: true,
      }),

    offlineReady: () =>
      toastService.success({
        id: "app-update",
        title: formatMessage({
          id: toastMessageIdsUpdate.offlineReady.title,
          defaultMessage: updateDefaults.offlineReady.title,
        }),
        message: formatMessage({
          id: toastMessageIdsUpdate.offlineReady.message,
          defaultMessage: updateDefaults.offlineReady.message,
        }),
        context: "app update",
        suppressLogging: true,
      }),

    checking: () =>
      toastService.loading({
        id: "app-update",
        title: formatMessage({
          id: toastMessageIdsUpdate.checking.title,
          defaultMessage: updateDefaults.checking.title,
        }),
        message: formatMessage({
          id: toastMessageIdsUpdate.checking.message,
          defaultMessage: updateDefaults.checking.message,
        }),
        context: "app update",
        suppressLogging: true,
      }),

    downloading: () =>
      toastService.loading({
        id: "app-update",
        title: formatMessage({
          id: toastMessageIdsUpdate.downloading.title,
          defaultMessage: updateDefaults.downloading.title,
        }),
        message: formatMessage({
          id: toastMessageIdsUpdate.downloading.message,
          defaultMessage: updateDefaults.downloading.message,
        }),
        context: "app update",
        suppressLogging: true,
      }),

    ready: (onUpdate: () => void, onDismiss?: () => void) =>
      toastService.info({
        id: "app-update",
        title: formatMessage({
          id: toastMessageIdsUpdate.ready.title,
          defaultMessage: updateDefaults.ready.title,
        }),
        message: formatMessage({
          id: toastMessageIdsUpdate.ready.message,
          defaultMessage: updateDefaults.ready.message,
        }),
        context: "app update",
        persistent: true,
        action: {
          label: formatMessage({
            id: toastMessageIdsUpdate.ready.action,
            defaultMessage: updateDefaults.ready.action,
          }),
          onClick: onUpdate,
          dismissOnClick: false,
          testId: "update-now-button",
        },
        closable: true,
        onDismiss,
        suppressLogging: true,
      }),

    applying: () =>
      toastService.loading({
        id: "app-update",
        title: formatMessage({
          id: toastMessageIdsUpdate.applying.title,
          defaultMessage: updateDefaults.applying.title,
        }),
        message: formatMessage({
          id: toastMessageIdsUpdate.applying.message,
          defaultMessage: updateDefaults.applying.message,
        }),
        context: "app update",
        suppressLogging: true,
      }),

    stalled: (onRetry: () => void, onDismiss?: () => void) =>
      toastService.info({
        id: "app-update",
        title: formatMessage({
          id: toastMessageIdsUpdate.stalled.title,
          defaultMessage: updateDefaults.stalled.title,
        }),
        message: formatMessage({
          id: toastMessageIdsUpdate.stalled.message,
          defaultMessage: updateDefaults.stalled.message,
        }),
        context: "app update",
        persistent: true,
        action: {
          label: formatMessage({
            id: toastMessageIdsUpdate.stalled.action,
            defaultMessage: updateDefaults.stalled.action,
          }),
          onClick: onRetry,
          dismissOnClick: false,
          testId: "update-retry-button",
        },
        closable: true,
        onDismiss,
        suppressLogging: true,
      }),

    failed: (onRetry: () => void, onDismiss?: () => void) =>
      toastService.info({
        id: "app-update",
        title: formatMessage({
          id: toastMessageIdsUpdate.failed.title,
          defaultMessage: updateDefaults.failed.title,
        }),
        message: formatMessage({
          id: toastMessageIdsUpdate.failed.message,
          defaultMessage: updateDefaults.failed.message,
        }),
        context: "app update",
        persistent: true,
        action: {
          label: formatMessage({
            id: toastMessageIdsUpdate.failed.action,
            defaultMessage: updateDefaults.failed.action,
          }),
          onClick: onRetry,
          dismissOnClick: false,
          testId: "update-retry-download-button",
        },
        closable: true,
        onDismiss,
        suppressLogging: true,
      }),

    dismiss: () => toastService.dismiss("app-update"),
  };

  return {
    ...localizedToasts,
    available: localizedToasts.ready,
    updating: localizedToasts.applying,
  };
}
