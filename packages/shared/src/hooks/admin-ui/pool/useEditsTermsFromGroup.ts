/**
 * useEditsTermsFromGroup Hook
 *
 * Where a promise's reward and confirmers are edited (PRD-1548): from its group's inspector while
 * the pool lists it in a group or the group still has copies queued on this device, and on its own
 * otherwise, a group's lone surviving copy included. Null while the promise's words, the pool's
 * promises or their words are still being read. Every read is the Pool tab's own, under its keys,
 * so an inspector opened over the tab answers from its cache.
 *
 * @module hooks/admin-ui/pool/useEditsTermsFromGroup
 */

import { useMemo } from "react";
import { editsTermsFromGroup } from "../../../modules/commitment-pooling/display-groups";
import { isResolvableMetadataCID } from "../../../modules/commitment-pooling/metadata";
import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types-core";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import {
  useCommitmentMetadata,
  useCommitmentMetadataFor,
} from "../../commitment-pooling/useCommitmentMetadata";
import { useQueuedGroupCopies } from "./useFinishCreating";

const NO_PROMISES: readonly CommitmentReadModel[] = [];

export function useEditsTermsFromGroup(
  chainId: number,
  commitment: CommitmentReadModel | null | undefined,
  /** The pool's promises, or undefined while they are being read. */
  poolCommitments: readonly CommitmentReadModel[] | undefined
): boolean | null {
  const owner = usePrimaryAddress() ?? null;
  const metadata = useCommitmentMetadataFor(commitment ?? undefined);
  const poolWords = useCommitmentMetadata(poolCommitments ?? NO_PROMISES);
  const queuedGroupCopies = useQueuedGroupCopies({ chainId, owner });

  return useMemo(() => {
    const wordsRead = metadata !== null || !isResolvableMetadataCID(commitment?.metadataCID);
    if (!commitment || !wordsRead) return null;
    const groupId = metadata?.displayGroup?.id ?? null;
    if (!groupId) return false;
    const metadataByCID = new Map(poolWords.byCID);
    if (metadata && isResolvableMetadataCID(commitment.metadataCID)) {
      metadataByCID.set(commitment.metadataCID.trim(), metadata);
    }
    return editsTermsFromGroup(commitment, {
      groupId,
      commitments: poolCommitments ?? null,
      metadataByCID,
      wordsSettled: !poolWords.isLoading,
      queuedCopies: queuedGroupCopies.get(groupId)?.length ?? 0,
    });
  }, [commitment, metadata, poolWords, poolCommitments, queuedGroupCopies]);
}
