/**
 * useCommitmentJobs Hook
 *
 * The member's write path for commitment pooling. Every one of these acts is
 * something a gardener does in a field with no signal, so all of them go
 * through the offline queue rather than straight to the chain.
 *
 * The queue already owns the hard parts: it refuses a chain where pooling is
 * unavailable, materializes the creator-scoped request key from a stable client
 * id, and returns the existing job when the same act is enqueued twice, so a
 * double tap can never become two commitments. What this hook adds is the seam
 * a view can call, and the stable client ids the queue's dedupe depends on.
 *
 * @module hooks/commitment-pooling/useCommitmentJobs
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../../config/query-keys";
import { jobQueue } from "../../modules/job-queue";
import type {
  ClaimJobPayload,
  CommitmentCreationPayload,
  EvidenceJobPayload,
  WorkLinkJobPayload,
} from "../../modules/commitment-pooling/jobs";
import type { Address } from "../../types/domain";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCurrentChain } from "../blockchain/useChainConfig";

/** What a view asks for, before the queue fills in keys and hashes. */
export type CommitmentJobInput =
  | { act: "claim"; payload: ClaimJobPayload }
  | { act: "evidence"; payload: EvidenceJobPayload }
  | { act: "workLink"; payload: Omit<WorkLinkJobPayload, "operationKey"> }
  | { act: "sendForConfirmation"; commitmentId: bigint; gardenAddress: Address }
  | {
      act: "confirm";
      commitmentId: bigint;
      gardenAddress: Address;
      /** The reader was seated through the commitment's named confirmer list. */
      membershipNotRequired?: boolean;
    }
  | { act: "create"; payload: Omit<CommitmentCreationPayload, "creationRequestKey"> };

/**
 * The commitment this act belongs to, where there is one. Creation has no id
 * yet, which is exactly why it carries a client-side one instead.
 */
function subjectCommitmentId(input: CommitmentJobInput): bigint | null {
  switch (input.act) {
    case "claim":
    case "evidence":
      return input.payload.commitmentId;
    case "workLink":
      return input.payload.commitmentId;
    case "sendForConfirmation":
    case "confirm":
      return input.commitmentId;
    default:
      return null;
  }
}

export function useCommitmentJobs(options: { chainId?: number } = {}) {
  const currentChainId = useCurrentChain();
  const chainId = options.chainId ?? currentChainId;
  const viewer = usePrimaryAddress();
  const queryClient = useQueryClient();
  const handleError = createMutationErrorHandler({
    source: "useCommitmentJobs",
    toastContext: "commitment",
  });

  const mutation = useMutation({
    mutationFn: async (input: CommitmentJobInput) => {
      if (!viewer) throw new Error("Sign in before making a commitment");
      const meta = { chainId };

      switch (input.act) {
        case "claim":
          return jobQueue.addJob("claim", input.payload, viewer, meta);
        case "evidence":
          return jobQueue.addJob("evidence", input.payload, viewer, meta);
        case "workLink":
          // `operationKey` is derived by the queue from `clientOperationId`, so a
          // retry behind the same button reuses the key rather than minting one.
          return jobQueue.addJob("workLink", input.payload as WorkLinkJobPayload, viewer, meta);
        case "sendForConfirmation":
          return jobQueue.addJob(
            "confirmation",
            {
              action: "submit",
              commitmentId: input.commitmentId,
              gardenAddress: input.gardenAddress,
            },
            viewer,
            meta
          );
        case "confirm":
          return jobQueue.addJob(
            "confirmation",
            {
              action: "confirm",
              commitmentId: input.commitmentId,
              gardenAddress: input.gardenAddress,
              ...(input.membershipNotRequired ? { membershipNotRequired: true } : {}),
            },
            viewer,
            meta
          );
        case "create":
          return jobQueue.addJob(
            "commitment",
            input.payload as CommitmentCreationPayload,
            viewer,
            meta
          );
      }
    },
    onSuccess: async (_jobId, input) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.commitmentPooling.all(chainId) });
      const commitmentId = subjectCommitmentId(input);
      if (commitmentId !== null) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.commitmentPooling.commitment(chainId, commitmentId),
        });
      }
    },
    onError: (error, input) => {
      handleError(error, { metadata: { act: input.act, chainId } });
    },
  });

  return {
    // `mutateAsync` is already a stable reference, so wrapping it would add a
    // memo that guards nothing.
    enqueue: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    /** Absent until somebody is signed in; every act needs an owner. */
    viewer: viewer as Address | null,
  };
}
