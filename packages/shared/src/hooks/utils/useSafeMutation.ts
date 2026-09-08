/**
 * Safe Mutation Hook
 *
 * Wraps a TanStack Query mutation with:
 * - Double-submit prevention via useMutationLock
 * - beforeunload guard while an in-page signer is pending
 * - Consistent isPending derivation (mutation + lock)
 *
 * @module hooks/utils/useSafeMutation
 */

import { useCallback } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { useOptionalAuthContext } from "../../providers/Auth";
import { useBeforeUnloadWhilePending } from "./useBeforeUnloadWhilePending";
import { useMutationLock } from "./useMutationLock";

/**
 * Wrap a mutation with lock-based double-submit prevention and
 * a beforeunload guard. Returns the same mutation shape with
 * overridden `mutate`, `mutateAsync`, and `isPending`.
 *
 * The guard protects in-page signers (passkey, embedded), whose pending
 * transaction is lost with the page. An external wallet signs outside the
 * page, so its pending window is an expected handoff: mobile wallets deep-link
 * away from the app to sign, and that navigation must not raise the browser's
 * leave-page prompt.
 *
 * @param mutation - The TanStack Query mutation to wrap
 * @param lockKey - Optional shared lock key (e.g. "approval" for single + batch hooks)
 *
 * @example
 * ```tsx
 * const mutation = useMutation({ mutationFn: ... });
 * return useSafeMutation(mutation);
 *
 * // With shared lock
 * return useSafeMutation(mutation, "approval");
 * ```
 */
export function useSafeMutation<TData, TError, TVariables, TContext>(
  mutation: UseMutationResult<TData, TError, TVariables, TContext>,
  lockKey?: string
) {
  const authMode = useOptionalAuthContext()?.authMode;
  const { runWithLock, isPending: isLockPending } = useMutationLock(lockKey);
  const isPending = mutation.isPending || isLockPending;
  useBeforeUnloadWhilePending(isPending && authMode !== "wallet");

  const mutateAsync = useCallback(
    (...args: Parameters<typeof mutation.mutateAsync>) =>
      runWithLock(() => mutation.mutateAsync(...args)),
    [mutation, runWithLock]
  );

  const mutate = useCallback(
    (...args: Parameters<typeof mutation.mutate>) => {
      void mutateAsync(...args).catch(() => undefined);
    },
    [mutateAsync]
  );

  return { ...mutation, mutate, mutateAsync, isPending };
}
