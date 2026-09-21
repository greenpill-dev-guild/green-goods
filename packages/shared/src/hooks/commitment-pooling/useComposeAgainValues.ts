/**
 * useComposeAgainValues Hook
 *
 * The composer answers to start from when a commitment is being made again,
 * read from the commitment it names.
 *
 * Two guards decide whether there is anything to start from, and both answer
 * with nothing rather than an error, so a link somebody edited opens an ordinary
 * empty composer:
 *
 * - The member's composer starts only from a commitment the reader made. The new
 *   one goes out under their name, in their words; starting from somebody else's
 *   is a different act. A steward seeding the pool may start from any commitment
 *   in it, which is what seeding is.
 * - The source has to belong to the pool being composed into. Its requirement
 *   rows name that pool's actions, and its terms were agreed there.
 *
 * @module hooks/commitment-pooling/useComposeAgainValues
 */

import { useMemo } from "react";

import {
  type ComposeAgainComposer,
  composerValuesFromCommitment,
} from "../../modules/commitment-pooling/compose-again";
import { isCommitmentCreator } from "../../modules/commitment-pooling/selectors";
import type { Address } from "../../types/domain";
import type { CommitmentComposerValues } from "./useCommitmentComposerForm";
import { useCommitmentMetadataFor } from "./useCommitmentMetadata";
import { useCommitment } from "./useCommitmentPooling";

export function useComposeAgainValues(input: {
  chainId: number;
  /** The commitment to start from, or null for an ordinary empty composer. */
  fromCommitmentId: bigint | null;
  composer: ComposeAgainComposer;
  viewer?: Address | null;
  /** The pool being composed into. Nothing is offered until it is known. */
  poolId?: bigint;
}): Partial<CommitmentComposerValues> | null {
  const { chainId, fromCommitmentId, composer, viewer, poolId } = input;
  const source = useCommitment(
    { chainId, commitmentId: fromCommitmentId ?? 0n },
    { enabled: fromCommitmentId !== null }
  );
  const detail = fromCommitmentId === null ? null : source.detail;
  const metadata = useCommitmentMetadataFor(detail?.commitment);

  return useMemo(() => {
    if (!detail || poolId === undefined || detail.commitment.poolId !== poolId) return null;
    const ownsIt = isCommitmentCreator({
      commitment: detail.commitment,
      viewer: viewer ?? undefined,
    });
    if (composer === "member" && !ownsIt) return null;
    return composerValuesFromCommitment({
      composer,
      commitment: detail.commitment,
      metadata,
      requirements: detail.requirements,
    });
  }, [detail, metadata, composer, viewer, poolId]);
}
