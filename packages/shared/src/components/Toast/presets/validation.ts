import { toastService } from "../toast.service";
import { getLocalizedToastFamily } from "./registry";
import { type FormatMessageFn, toastMessageIds } from "./types";

/** Default (English) fallback messages for validation toasts */
const validationDefaults = {
  formError: { title: "Check your submission" },
};

/**
 * Create i18n-aware validation toasts
 * @param formatMessage - react-intl formatMessage function
 */
export function createValidationToasts(formatMessage: FormatMessageFn) {
  return {
    formError: (message: string) =>
      toastService.error({
        title: formatMessage({
          id: toastMessageIds.validation.formError.title,
          defaultMessage: validationDefaults.formError.title,
        }),
        message,
        context: "work form validation",
        suppressLogging: true,
      }),

    approvalError: (title: string, message: string) =>
      toastService.error({
        title,
        message,
        context: "work approval",
      }),
  };
}

function localized() {
  return getLocalizedToastFamily("validation", createValidationToasts);
}

export const validationToasts = {
  formError: (message: string) => {
    const bound = localized();
    if (bound) return bound.formError(message);
    return toastService.error({
      title: validationDefaults.formError.title,
      message,
      context: "work form validation",
      suppressLogging: true,
    });
  },

  approvalError: (title: string, message: string) =>
    toastService.error({
      title,
      message,
      context: "work approval",
    }),
};
