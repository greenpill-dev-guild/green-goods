/**
 * Mutation with Tracking Hook
 *
 * Provides a wrapper around useMutation that includes built-in:
 * - Toast notifications for success/error states
 * - Consistent error handling patterns
 *
 * @module hooks/app/useMutationWithTracking
 */

import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { useRef } from "react";
import { toastService, type ToastDescriptor } from "../../components/toast";

/**
 * Toast configuration for mutation states
 */
export interface MutationToastConfig {
  /** Toast to show while mutation is pending (optional) */
  loading?: ToastDescriptor;
  /** Toast to show on success */
  success?: ToastDescriptor;
  /** Toast to show on error (will include error details) */
  error?: ToastDescriptor;
}

/**
 * Analytics tracking configuration
 */
export interface MutationTrackingConfig {
  /** Event name to track when mutation starts */
  started?: string;
  /** Event name to track on success */
  success?: string;
  /** Event name to track on error */
  error?: string;
  /** Additional properties to include in all tracking events */
  properties?: Record<string, unknown>;
}

/**
 * Extended mutation options with tracking - toasts only (no callbacks override)
 *
 * Note: TContext is always undefined because this hook manages onMutate internally
 * and does not support custom context values.
 */
export interface UseMutationWithTrackingOptions<TData, TError, TVariables>
  extends Omit<
    UseMutationOptions<TData, TError, TVariables, undefined>,
    "onMutate" | "onSuccess" | "onError" | "onSettled"
  > {
  /** Toast notifications for different mutation states */
  toasts?: MutationToastConfig;
  /** Analytics tracking configuration */
  tracking?: MutationTrackingConfig;
  /** Context string for error logging */
  errorContext?: string;
}

/**
 * Custom hook that wraps useMutation with built-in toast notifications.
 *
 * Note: This hook does not support custom onSuccess/onError callbacks.
 * If you need custom callbacks, use the standard useMutation and add toasts manually.
 *
 * @example
 * ```typescript
 * const { mutate } = useMutationWithTracking({
 *   mutationFn: async (data) => api.createItem(data),
 *   toasts: {
 *     success: { title: "Item created", message: "Your item has been saved." },
 *     error: { title: "Failed to create item" },
 *   },
 * });
 * ```
 */
export function useMutationWithTracking<TData = unknown, TError = Error, TVariables = void>(
  options: UseMutationWithTrackingOptions<TData, TError, TVariables>
) {
  const { toasts, errorContext = "mutation", ...mutationOptions } = options;

  // Generate a unique toast ID for this hook instance to prevent collisions
  // when multiple mutations with the same errorContext run concurrently.
  // Uses true lazy initialization to avoid evaluating the initializer on every render
  // (which is fragile under React 18 concurrent mode).
  const toastIdRef = useRef<string | null>(null);
  if (toastIdRef.current === null) {
    toastIdRef.current =
      toasts?.loading?.id ??
      `mutation-${errorContext}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
  const toastId = toastIdRef.current;

  return useMutation<TData, TError, TVariables, undefined>({
    ...mutationOptions,
    onMutate: async () => {
      // Show loading toast if configured
      if (toasts?.loading) {
        toastService.loading({ ...toasts.loading, id: toastId });
      }
      return undefined;
    },
    onSuccess: () => {
      // Show success toast if configured (replaces loading toast via same ID)
      if (toasts?.success) {
        toastService.success({
          ...toasts.success,
          id: toastId,
          context: errorContext,
          suppressLogging: true,
        });
      } else if (toasts?.loading) {
        // Dismiss loading toast if no success toast configured
        toastService.dismiss(toastId);
      }
    },
    onError: (error: TError) => {
      // Show error toast if configured (replaces loading toast via same ID)
      if (toasts?.error) {
        const errorMessage =
          error instanceof Error ? error.message : "An unexpected error occurred.";
        toastService.error({
          ...toasts.error,
          id: toastId,
          message: toasts.error.message || errorMessage,
          context: errorContext,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      } else if (toasts?.loading) {
        // Dismiss loading toast if no error toast configured
        toastService.dismiss(toastId);
      }
    },
  });
}

/**
 * Create a typed mutation factory with default toast configuration
 *
 * @example
 * ```typescript
 * const useApiMutation = createMutationFactory({
 *   errorContext: "api",
 * });
 *
 * // Use the factory
 * const { mutate } = useApiMutation({
 *   mutationFn: async (data) => api.createItem(data),
 *   toasts: {
 *     success: { title: "Created", message: "Item created successfully." },
 *   },
 * });
 * ```
 */
export function createMutationFactory(defaultOptions: {
  errorContext?: string;
  defaultToasts?: Partial<MutationToastConfig>;
}) {
  return function useFactoryMutation<TData = unknown, TError = Error, TVariables = void>(
    options: UseMutationWithTrackingOptions<TData, TError, TVariables>
  ) {
    return useMutationWithTracking({
      errorContext: defaultOptions.errorContext,
      toasts: {
        ...defaultOptions.defaultToasts,
        ...options.toasts,
      },
      ...options,
    });
  };
}
