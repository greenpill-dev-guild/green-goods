import { toastService } from "../toast.service";
import { type FormatMessageFn, toastMessageIds } from "./types";

/** Default (English) fallback messages for validation toasts */
const validationDefaults = {
  formError: { title: "Check your submission" },
};

export const validationToasts = {
  /** Show error for form validation failure */
  formError: (message: string) =>
    toastService.error({
      title: validationDefaults.formError.title,
      message,
      context: "work form validation",
      suppressLogging: true,
    }),

  /** Show error for approval validation failure */
  approvalError: (title: string, message: string) =>
    toastService.error({
      title,
      message,
      context: "work approval",
    }),
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
