# Eval Task: Fix Mutation Error Handling in `useArchiveAction`

## Brief

A synthetic hook `useArchiveAction` was written with improper error handling. Fix it to comply with codebase patterns.

## Synthetic Code (paste into `packages/shared/src/hooks/action/useArchiveAction.ts` before running eval)

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Address } from "../../types/domain";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { toastService } from "../../components/toast";
import { useUser } from "../auth/useUser";
import { queryKeys } from "../query-keys";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { actionRegistryAbi } from "../../generated/contracts";

interface ArchiveActionParams {
  gardenAddress: Address;
  actionId: string;
}

export function useArchiveAction() {
  const { authMode } = useUser();
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const { sendTransaction } = useContractTxSender();

  return useMutation({
    mutationFn: async ({ gardenAddress, actionId }: ArchiveActionParams) => {
      return sendTransaction({
        address: gardenAddress,
        abi: actionRegistryAbi,
        functionName: "archiveAction",
        args: [actionId],
      });
    },
    onSuccess: (_data, variables) => {
      toastService.success({
        id: "archive-action",
        title: "Action archived",
        message: "The action has been archived successfully.",
        context: "archive action",
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.actions.list(variables.gardenAddress, chainId),
      });
    },
    onError: (error) => {
      console.error("Failed to archive action:", error);
      toastService.error({
        id: "archive-action",
        title: "Archive failed",
        message: "Could not archive the action. Please try again.",
        context: "archive action",
      });
    },
  });
}
```

## Bug Description

The `onError` handler uses `console.error` directly instead of the codebase's error handling pattern. Per CLAUDE.md Key Patterns and TypeScript Rule #4:

1. Contract errors must use `parseContractError()` + `USER_FRIENDLY_ERRORS`
2. Mutation hooks must use `createMutationErrorHandler()` from shared utils
3. No `console.log/warn/error` in production code — use `logger` from shared (Rule #12)

## Requirements

1. Replace `console.error` with `createMutationErrorHandler()` pattern
2. Ensure contract errors are parsed with `parseContractError()` for user-friendly messages
3. Preserve existing behavior (toast on error, query invalidation on success)
4. Do NOT change the mutation function signature or success handler
5. Write a test that verifies the error handler is called correctly

## Constraints Under Test

- **Error Handling Pattern**: Must use `createMutationErrorHandler()`, not raw `console.error`
- **No console.log**: No `console.log`, `console.warn`, or `console.error` in final code
- **Behavioral Preservation**: Success path and mutation signature must remain unchanged
- **TDD**: Test must verify error path behavior
