import { useCallback } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../toast";

export interface ToastActionOptions {
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  duration?: number;
  loadingTitle?: string;
  successTitle?: string;
  errorTitle?: string;
  context?: string;
  suppressLogging?: boolean;
}

export function useToastAction() {
  const intl = useIntl();

  const executeWithToast = useCallback(
    async <T>(action: () => Promise<T>, options: ToastActionOptions = {}): Promise<T> => {
      const defaultLoadingMessage = intl.formatMessage({
        id: "app.toast.default.loadingMessage",
        defaultMessage: "Processing...",
      });
      const defaultSuccessMessage = intl.formatMessage({
        id: "app.toast.default.successMessage",
        defaultMessage: "Action completed successfully",
      });
      const defaultErrorMessage = intl.formatMessage({
        id: "app.toast.default.errorMessage",
        defaultMessage: "Action failed",
      });

      const {
        loadingMessage = defaultLoadingMessage,
        loadingTitle,
        successMessage = defaultSuccessMessage,
        successTitle,
        errorMessage = defaultErrorMessage,
        errorTitle,
        duration = 3000,
        context,
        suppressLogging,
      } = options;

      const toastId = toastService.loading({
        message: loadingMessage,
        title: loadingTitle,
        context,
        suppressLogging: true,
      });

      try {
        const result = await action();
        toastService.success({
          id: toastId,
          message: successMessage,
          title: successTitle,
          context,
          duration,
          suppressLogging: true,
        });
        return result;
      } catch (error) {
        toastService.error({
          id: toastId,
          message: errorMessage ?? "Action failed",
          title: errorTitle,
          context,
          duration: 4500,
          error,
          suppressLogging,
        });
        throw error;
      }
    },
    [intl]
  );

  return { executeWithToast };
}
