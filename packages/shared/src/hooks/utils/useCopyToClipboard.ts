/**
 * Copy to Clipboard Hook
 *
 * Provides clipboard functionality with automatic reset timer and proper cleanup.
 * Consolidates the repeated "copy with 2-second reset" pattern across the codebase.
 *
 * @module hooks/utils/useCopyToClipboard
 */

import { useCallback, useState } from "react";

import { copyToClipboard } from "../../utils/app/clipboard";
import { useTimeout } from "./useTimeout";

export interface UseCopyToClipboardOptions {
  /** Delay in ms before resetting copied state (default: 2000) */
  resetDelay?: number;
  /** Callback when copy succeeds */
  onSuccess?: () => void;
  /** Callback when copy fails */
  onError?: (error: unknown) => void;
}

export interface UseCopyToClipboardReturn {
  /** Whether content was recently copied */
  copied: boolean;
  /** Copy text to clipboard and set copied state */
  copy: (text: string) => Promise<boolean>;
  /** Manually reset the copied state */
  reset: () => void;
}

/**
 * Hook for clipboard operations with automatic state reset.
 *
 * @param options - Configuration options
 * @returns Object with copied state, copy function, and reset function
 *
 * @example
 * ```tsx
 * function AddressCopy({ address }: { address: string }) {
 *   const { copied, copy } = useCopyToClipboard({
 *     onSuccess: () => toast.success("Copied!"),
 *   });
 *
 *   return (
 *     <button onClick={() => copy(address)}>
 *       {copied ? <CheckIcon /> : <CopyIcon />}
 *     </button>
 *   );
 * }
 * ```
 */
export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardReturn {
  const { resetDelay = 2000, onSuccess, onError } = options;

  const [copied, setCopied] = useState(false);
  const { set: scheduleReset, clear } = useTimeout();

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        const success = await copyToClipboard(text);

        if (success) {
          setCopied(true);
          scheduleReset(() => setCopied(false), resetDelay);
          onSuccess?.();
        } else {
          // Call onError when copyToClipboard returns false (e.g., browser API unavailable)
          onError?.(new Error("Copy to clipboard failed"));
        }

        return success;
      } catch (error) {
        onError?.(error);
        return false;
      }
    },
    [resetDelay, scheduleReset, onSuccess, onError]
  );

  const reset = useCallback(() => {
    clear();
    setCopied(false);
  }, [clear]);

  return { copied, copy, reset };
}
