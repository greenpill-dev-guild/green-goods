import { useCallback } from "react";
import toast from "react-hot-toast";

export interface ToastActionOptions {
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  duration?: number;
}

export function useToastAction() {
  const executeWithToast = useCallback(
    async <T>(action: () => Promise<T>, options: ToastActionOptions = {}): Promise<T> => {
      const {
        loadingMessage = "Processing...",
        successMessage = "Action completed successfully",
        errorMessage = "Action failed",
        duration = 3000,
      } = options;

      const toastId = toast.loading(loadingMessage);

      try {
        const result = await action();
        toast.success(successMessage, { id: toastId, duration });
        return result;
      } catch (error) {
        // console.error("Toast action failed:", error);
        const message = error instanceof Error ? error.message : errorMessage;
        toast.error(message, { id: toastId, duration: 4500 });
        throw error;
      }
    },
    []
  );

  return { executeWithToast };
}
