import { toastService } from "../toast.service";
import { type FormatMessageFn, toastMessageIds } from "./types";

/** Default (English) fallback messages for work toasts */
const workDefaults = {
  submitting: { title: "Submitting work", message: "Processing your submission..." },
  success: { title: "Work submitted", message: "Your work is now on-chain" },
  savedOffline: { title: "Saved offline", message: "Work added to upload queue" },
  error: { title: "Work submission failed" },
};

export const workToasts = {
  /** Show loading state when submitting work */
  submitting: () =>
    toastService.loading({
      id: "work-upload",
      title: workDefaults.submitting.title,
      message: workDefaults.submitting.message,
      context: "work upload",
      suppressLogging: true,
    }),

  /** Show success state when work is submitted online */
  success: () =>
    toastService.success({
      id: "work-upload",
      title: workDefaults.success.title,
      message: workDefaults.success.message,
      context: "work upload",
      suppressLogging: true,
    }),

  /** Show info state when work is saved offline */
  savedOffline: () =>
    toastService.info({
      id: "work-upload",
      title: workDefaults.savedOffline.title,
      message: workDefaults.savedOffline.message,
      context: "work upload",
      duration: 2000,
      suppressLogging: true,
    }),

  /** Show error state for work submission failure */
  error: (message: string, description?: string) =>
    toastService.error({
      id: "work-upload",
      title: workDefaults.error.title,
      message,
      context: "work upload",
      description,
    }),

  /** Dismiss the work upload toast */
  dismiss: () => toastService.dismiss("work-upload"),
};

/**
 * Create i18n-aware work toasts
 * @param formatMessage - react-intl formatMessage function
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
