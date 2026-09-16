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
    title: "Update needs a restart",
    message: "Please close and reopen the app to finish updating.",
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

export const updateToasts = {
  /** Confirm, once, that a restart landed on the new version */
  applied: () =>
    toastService.success({
      id: "app-update",
      title: updateDefaults.applied.title,
      message: updateDefaults.applied.message,
      context: "app update",
      suppressLogging: true,
    }),

  /** Report that the restarted app is still fetching what it needs offline */
  preparingOffline: () =>
    toastService.loading({
      id: "app-update",
      title: updateDefaults.preparingOffline.title,
      message: updateDefaults.preparingOffline.message,
      context: "app update",
      suppressLogging: true,
    }),

  /** Close the loop opened by `preparingOffline` */
  offlineReady: () =>
    toastService.success({
      id: "app-update",
      title: updateDefaults.offlineReady.title,
      message: updateDefaults.offlineReady.message,
      context: "app update",
      suppressLogging: true,
    }),

  /** Show quiet progress when an explicit update check is running */
  checking: () =>
    toastService.loading({
      id: "app-update",
      title: updateDefaults.checking.title,
      message: updateDefaults.checking.message,
      context: "app update",
      suppressLogging: true,
    }),

  /** Show progress while the browser installs the waiting worker */
  downloading: () =>
    toastService.loading({
      id: "app-update",
      title: updateDefaults.downloading.title,
      message: updateDefaults.downloading.message,
      context: "app update",
      suppressLogging: true,
    }),

  /** Show info when an update is ready with action to restart */
  ready: (onUpdate: () => void, onDismiss?: () => void) =>
    toastService.info({
      id: "app-update",
      title: updateDefaults.ready.title,
      message: updateDefaults.ready.message,
      context: "app update",
      persistent: true, // Stay visible until user acts or toast is replaced
      action: {
        label: updateDefaults.ready.action,
        onClick: onUpdate,
        dismissOnClick: false,
        testId: "update-now-button",
      },
      closable: true,
      onDismiss,
      suppressLogging: true,
    }),

  /** Show loading state when update is being applied */
  applying: () =>
    toastService.loading({
      id: "app-update",
      title: updateDefaults.applying.title,
      message: updateDefaults.applying.message,
      context: "app update",
      suppressLogging: true,
    }),

  /** Backward-compatible alias for the ready phase */
  available: (onUpdate: () => void, onDismiss?: () => void) =>
    toastService.info({
      id: "app-update",
      title: updateDefaults.ready.title,
      message: updateDefaults.ready.message,
      context: "app update",
      persistent: true,
      action: {
        label: updateDefaults.ready.action,
        onClick: onUpdate,
        dismissOnClick: false,
        testId: "update-now-button",
      },
      closable: true,
      onDismiss,
      suppressLogging: true,
    }),

  /** Backward-compatible alias for the applying phase */
  updating: () =>
    toastService.loading({
      id: "app-update",
      title: updateDefaults.applying.title,
      message: updateDefaults.applying.message,
      context: "app update",
      suppressLogging: true,
    }),

  /** Show manual restart guidance when applyUpdate times out */
  stalled: (onDismiss?: () => void) =>
    toastService.info({
      id: "app-update",
      title: updateDefaults.stalled.title,
      message: updateDefaults.stalled.message,
      context: "app update",
      persistent: true,
      closable: true,
      onDismiss,
      suppressLogging: true,
    }),

  /** Dismiss the update toast */
  dismiss: () => toastService.dismiss("app-update"),
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

    stalled: (onDismiss?: () => void) =>
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
