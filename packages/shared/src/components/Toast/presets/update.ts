import { toastService } from "../toast.service";
import { type FormatMessageFn, toastMessageIdsUpdate } from "./types";

/** Default (English) fallback messages for app update toasts */
const updateDefaults = {
  available: {
    title: "Update available",
    message: "A new version of Green Goods is ready.",
  },
  updating: {
    title: "Updating...",
    message: "Refreshing to the latest version.",
  },
  stalled: {
    title: "Update app",
    message: "The update didn't finish. Close all app tabs and try again.",
  },
};

export const updateToasts = {
  /** Show info when an update is available with action to refresh */
  available: (onUpdate: () => void, onDismiss?: () => void) =>
    toastService.info({
      id: "app-update",
      title: updateDefaults.available.title,
      message: updateDefaults.available.message,
      context: "app update",
      duration: Infinity, // Stay visible until user acts or toast is replaced
      action: {
        label: "Update now",
        onClick: onUpdate,
        dismissOnClick: false,
        testId: "update-now-button",
      },
      closable: true,
      onDismiss,
      suppressLogging: true,
    }),

  /** Show loading state when update is being applied */
  updating: () =>
    toastService.loading({
      id: "app-update",
      title: updateDefaults.updating.title,
      message: updateDefaults.updating.message,
      context: "app update",
      suppressLogging: true,
    }),

  /** Show recoverable state when an update activation times out */
  stalled: (onUpdate: () => void, onDismiss?: () => void) =>
    toastService.info({
      id: "app-update",
      title: updateDefaults.stalled.title,
      message: updateDefaults.stalled.message,
      context: "app update",
      duration: Infinity,
      action: {
        label: "Update now",
        onClick: onUpdate,
        dismissOnClick: false,
        testId: "update-now-button",
      },
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
  return {
    available: (onUpdate: () => void, onDismiss?: () => void) =>
      toastService.info({
        id: "app-update",
        title: formatMessage({
          id: toastMessageIdsUpdate.available.title,
          defaultMessage: updateDefaults.available.title,
        }),
        message: formatMessage({
          id: toastMessageIdsUpdate.available.message,
          defaultMessage: updateDefaults.available.message,
        }),
        context: "app update",
        duration: Infinity,
        action: {
          label: "Update now",
          onClick: onUpdate,
          dismissOnClick: false,
          testId: "update-now-button",
        },
        closable: true,
        onDismiss,
        suppressLogging: true,
      }),

    updating: () =>
      toastService.loading({
        id: "app-update",
        title: formatMessage({
          id: toastMessageIdsUpdate.updating.title,
          defaultMessage: updateDefaults.updating.title,
        }),
        message: formatMessage({
          id: toastMessageIdsUpdate.updating.message,
          defaultMessage: updateDefaults.updating.message,
        }),
        context: "app update",
        suppressLogging: true,
      }),

    stalled: (onUpdate: () => void, onDismiss?: () => void) =>
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
        duration: Infinity,
        action: {
          label: "Update now",
          onClick: onUpdate,
          dismissOnClick: false,
          testId: "update-now-button",
        },
        closable: true,
        onDismiss,
        suppressLogging: true,
      }),

    dismiss: () => toastService.dismiss("app-update"),
  };
}
