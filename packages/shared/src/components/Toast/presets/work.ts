import { toastService } from "../toast.service";
import { getLocalizedToastFamily } from "./registry";
import { type FormatMessageFn, toastMessageIds } from "./types";

/** Default (English) fallback messages for work toasts */
const workDefaults = {
  submitting: { title: "Submitting work", message: "Processing your submission..." },
  success: { title: "Work submitted", message: "Your work is now on-chain" },
  savedOffline: { title: "Saved offline", message: "Work added to upload queue" },
  error: { title: "Work submission failed" },
};

/**
 * i18n-aware factory. Used directly by tests and by the registry-backed
 * static facade exported below.
 */
export function createWorkToasts(formatMessage: FormatMessageFn) {
  return {
    submitting: () =>
      toastService.loading({
        id: "work-upload",
        title: formatMessage({
          id: toastMessageIds.work.submitting.title,
          defaultMessage: workDefaults.submitting.title,
        }),
        message: formatMessage({
          id: toastMessageIds.work.submitting.message,
          defaultMessage: workDefaults.submitting.message,
        }),
        context: "work upload",
        suppressLogging: true,
      }),

    success: () =>
      toastService.success({
        id: "work-upload",
        title: formatMessage({
          id: toastMessageIds.work.success.title,
          defaultMessage: workDefaults.success.title,
        }),
        message: formatMessage({
          id: toastMessageIds.work.success.message,
          defaultMessage: workDefaults.success.message,
        }),
        context: "work upload",
        suppressLogging: true,
      }),

    savedOffline: () =>
      toastService.info({
        id: "work-upload",
        title: formatMessage({
          id: toastMessageIds.work.savedOffline.title,
          defaultMessage: workDefaults.savedOffline.title,
        }),
        message: formatMessage({
          id: toastMessageIds.work.savedOffline.message,
          defaultMessage: workDefaults.savedOffline.message,
        }),
        context: "work upload",
        duration: 2000,
        suppressLogging: true,
      }),

    error: (message: string, description?: string) =>
      toastService.error({
        id: "work-upload",
        title: formatMessage({
          id: toastMessageIds.work.error.title,
          defaultMessage: workDefaults.error.title,
        }),
        message,
        context: "work upload",
        description,
      }),

    dismiss: () => toastService.dismiss("work-upload"),
  };
}

/** Resolve a localized factory if a formatter is bound; otherwise undefined. */
function localized() {
  return getLocalizedToastFamily("work", createWorkToasts);
}

/**
 * Static facade that routes through the localized registry when available.
 * PWA callsites keep their existing import (`workToasts.submitting()`); the
 * runtime locale follows whatever `LocalizedToastsBridge` last set.
 */
export const workToasts = {
  submitting: () => {
    const bound = localized();
    if (bound) return bound.submitting();
    return toastService.loading({
      id: "work-upload",
      title: workDefaults.submitting.title,
      message: workDefaults.submitting.message,
      context: "work upload",
      suppressLogging: true,
    });
  },

  success: () => {
    const bound = localized();
    if (bound) return bound.success();
    return toastService.success({
      id: "work-upload",
      title: workDefaults.success.title,
      message: workDefaults.success.message,
      context: "work upload",
      suppressLogging: true,
    });
  },

  savedOffline: () => {
    const bound = localized();
    if (bound) return bound.savedOffline();
    return toastService.info({
      id: "work-upload",
      title: workDefaults.savedOffline.title,
      message: workDefaults.savedOffline.message,
      context: "work upload",
      duration: 2000,
      suppressLogging: true,
    });
  },

  error: (message: string, description?: string) => {
    const bound = localized();
    if (bound) return bound.error(message, description);
    return toastService.error({
      id: "work-upload",
      title: workDefaults.error.title,
      message,
      context: "work upload",
      description,
    });
  },

  dismiss: () => toastService.dismiss("work-upload"),
};
