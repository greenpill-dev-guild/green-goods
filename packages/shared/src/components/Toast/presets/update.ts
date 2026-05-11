import { toastService } from "../toast.service";
import { getLocalizedToastFamily } from "./registry";
import { type FormatMessageFn, toastMessageIdsUpdate } from "./types";

const updateActionMessageIds = {
  updateNow: "app.toast.update.action.updateNow",
} as const;

/** Default (English) fallback messages for app update toasts */
const updateDefaults = {
  available: {
    title: "Update available",
    message: "A new version of Green Goods is ready.",
    actionLabel: "Update now",
  },
  updating: {
    title: "Updating...",
    message: "Refreshing to the latest version.",
  },
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
          label: formatMessage({
            id: updateActionMessageIds.updateNow,
            defaultMessage: updateDefaults.available.actionLabel,
          }),
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

    dismiss: () => toastService.dismiss("app-update"),
  };
}

function localized() {
  return getLocalizedToastFamily("update", createUpdateToasts);
}

export const updateToasts = {
  available: (onUpdate: () => void, onDismiss?: () => void) => {
    const bound = localized();
    if (bound) return bound.available(onUpdate, onDismiss);
    return toastService.info({
      id: "app-update",
      title: updateDefaults.available.title,
      message: updateDefaults.available.message,
      context: "app update",
      duration: Infinity,
      action: {
        label: updateDefaults.available.actionLabel,
        onClick: onUpdate,
        dismissOnClick: false,
        testId: "update-now-button",
      },
      closable: true,
      onDismiss,
      suppressLogging: true,
    });
  },

  updating: () => {
    const bound = localized();
    if (bound) return bound.updating();
    return toastService.loading({
      id: "app-update",
      title: updateDefaults.updating.title,
      message: updateDefaults.updating.message,
      context: "app update",
      suppressLogging: true,
    });
  },

  dismiss: () => toastService.dismiss("app-update"),
};
