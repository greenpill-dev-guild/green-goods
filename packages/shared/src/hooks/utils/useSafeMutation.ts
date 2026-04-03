/**
 * Safe Mutation Hook
 *
 * Wraps a TanStack Query mutation with:
 * - Double-submit prevention via useMutationLock
 * - beforeunload guard while pending
 * - Consistent isPending derivation (mutation + lock)
 *
 * @module hooks/utils/useSafeMutation
 */

import { useCallback } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { useBeforeUnloadWhilePending } from "./useBeforeUnloadWhilePending";
import { useMutationLock } from "./useMutationLock";

/**
 * Wrap a mutation with lock-based double-submit prevention and
 * a beforeunload guard. Returns the same mutation shape with
 * overridden `mutate`, `mutateAsync`, and `isPending`.
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
  lockKey?: string,
) {
  const { runWithLock, isPending: isLockPending } = useMutationLock(lockKey);
  const isPending = mutation.isPending || isLockPending;
  useBeforeUnloadWhilePending(isPending);

  const mutateAsync = useCallback(
    (...args: Parameters<typeof mutation.mutateAsync>) =>
      runWithLock(() => mutation.mutateAsync(...args)),
    [mutation, runWithLock],
  );

  const mutate = useCallback(
    (...args: Parameters<typeof mutation.mutate>) => {
      void mutateAsync(...args).catch(() => undefined);
    },
    [mutateAsync],
  );

  return { ...mutation, mutate, mutateAsync, isPending };
}
