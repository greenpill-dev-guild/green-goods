/**
 * useStewardDuties Hook
 *
 * What waits in one garden's queues for the reader, for Home's Needs Your Attention (PWA Home
 * decisions 22 and 27): work to review, take-up requests on approval-gated asks and promises to
 * confirm (`modules/garden/steward-duties`). Each queue is read, and listed, only for an account
 * that can perform the act it opens, under that act's existing predicate, so the section grants
 * nothing the screens do not:
 *
 * - work to review: the work page's steward mode, `canManageGarden` (a steward or an owner on
 *   the garden's record), counted as Your Work counts its To review rows;
 * - take-up requests: the claim panel's `stewardsPoolGarden`, a steward of the pool's garden as
 *   the chain answers it;
 * - promises to confirm: the To confirm tab's own, `canManageGarden`, as its rows for the garden.
 *
 * A gardener or an evaluator passes none of them, so neither reads nor sees anything here.
 * `useOpenStewardDuty` opens a duty's queue, the same from a Needs Your Attention row and from
 * the Highlights carousel's duty card.
 *
 * @module hooks/garden/useStewardDuties
 */

import { useCallback, useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { selectStewardDuties, type StewardDuty } from "../../modules/garden/steward-duties";
import { useUIStore } from "../../stores/useUIStore";
import type { Address, Garden } from "../../types/domain";
import { compareAddresses } from "../../utils/blockchain/address";
import { useNavigateToTop } from "../app/useNavigateToTop";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useUser } from "../auth/useUser";
import { useCommitmentPools } from "../commitment-pooling/useCommitmentPooling";
import { useCommitmentsToConfirm } from "../commitment-pooling/useCommitmentsToConfirm";
import { usePoolClaimRequests } from "../commitment-pooling/usePoolClaimRequests";
import { useHasRole } from "../roles/useHasRole";
import { useNeedsReview } from "../work/useNeedsReview";
import { useGardenPermissions } from "./useGardenPermissions";

const NO_GARDENS: string[] = [];

export interface StewardDuties {
  /** The queues with something waiting that the account can act on, in the section's order. */
  duties: StewardDuty[];
  /** A queue the account can act on has not answered yet. */
  isLoading: boolean;
  /** A queue the account can act on could not be read, so something waiting may be missing. */
  isError: boolean;
  /** Read every queue again. */
  refetch: () => void;
}

export function useStewardDuties(garden: Garden): StewardDuties {
  const chainId = DEFAULT_CHAIN_ID;
  const account = usePrimaryAddress() as Address | null;
  const { user } = useUser();
  // The work page approves, and the To confirm tab lists a garden, for its stewards and owners.
  const managesGarden = useGardenPermissions().canManageGarden(garden);

  const review = useNeedsReview(managesGarden ? [garden.id] : NO_GARDENS, user?.id);

  const poolsRead = useCommitmentPools({ chainId, garden: garden.id as Address });
  const pool = poolsRead.pools.find((candidate) => compareAddresses(candidate.garden, garden.id));
  // The claim panel lets a steward of the pool's garden decide, as the chain answers it.
  const stewardRole = useHasRole(pool?.garden, account, "steward", chainId);
  const stewardsPoolGarden = stewardRole.hasRole;
  const claims = usePoolClaimRequests(
    { chainId, poolId: pool?.poolId ?? 0n, state: "PENDING" },
    { enabled: Boolean(pool) && stewardsPoolGarden }
  );

  // This garden alone: another garden's queue is not this Home's to wait on or fail with.
  const thisGarden = useCallback(
    (gardens: readonly (string | null | undefined)[]) =>
      gardens.some((candidate) => compareAddresses(candidate, garden.id)),
    [garden.id]
  );
  const confirm = useCommitmentsToConfirm({
    chainId,
    viewer: managesGarden ? (account ?? undefined) : undefined,
    inScope: thisGarden,
  });
  const toConfirm = useMemo(
    () =>
      confirm.groups
        .find((group) => compareAddresses(group.garden, garden.id))
        ?.rows.map((row) => row.commitment) ?? [],
    [confirm.groups, garden.id]
  );

  const duties = useMemo(
    () =>
      selectStewardDuties({
        viewer: account,
        // A count only once the garden's whole list is read, as the arrival toast does: a
        // partial page would undercount the queue the row opens.
        toReview: review.ready ? review.works : [],
        // A disabled read still hands back what it read before; only a decider sees it.
        pendingClaims: stewardsPoolGarden ? claims.rows : [],
        toConfirm,
      }),
    [account, review.ready, review.works, stewardsPoolGarden, claims.rows, toConfirm]
  );

  const { refetch: refetchReview } = review;
  const { refetch: refetchClaims } = claims;
  const { refetch: refetchConfirm } = confirm;
  const { refetch: refetchPools } = poolsRead;
  const { refetch: refetchRole } = stewardRole;
  const refetch = useCallback(() => {
    void refetchReview();
    void refetchPools();
    void refetchRole();
    void refetchClaims();
    void refetchConfirm();
  }, [refetchReview, refetchPools, refetchRole, refetchClaims, refetchConfirm]);

  const decidesClaims = Boolean(pool) && stewardsPoolGarden;
  // Who may decide take-ups rests on two reads of its own: the garden's pool, then the chain's
  // answer on its steward. Either one failing may hide take-up requests, so it counts for whoever
  // manages the garden on the record.
  const takeUpPathLoading = poolsRead.isLoading || stewardRole.isLoading;
  const takeUpPathFailed = poolsRead.isError || Boolean(stewardRole.error);
  return {
    duties,
    isLoading:
      (managesGarden && (review.isLoading || confirm.isLoading || takeUpPathLoading)) ||
      (decidesClaims && claims.isLoading),
    isError:
      (managesGarden && (review.isError || confirm.isError || takeUpPathFailed)) ||
      (decidesClaims && claims.isError),
    refetch,
  };
}

/**
 * Opens a duty's exact queue (DL-127): work to review, the garden's work, Pending first, until
 * the Work sheet over Home lands (DL-128); a promise's take-up requests, its page, where the
 * claim panel decides them; promises to confirm, the Promises sheet on To confirm.
 */
export function useOpenStewardDuty(gardenId: string): (duty: StewardDuty) => void {
  const navigate = useNavigateToTop();
  const openCommitmentsSheet = useUIStore((state) => state.openCommitmentsSheet);
  return (duty) => {
    switch (duty.kind) {
      case "review":
        return navigate(`/home/${gardenId}`);
      case "takeUp":
        return navigate(`/home/${gardenId}/commitments/${duty.commitment.commitmentId.toString()}`);
      case "confirm":
        return openCommitmentsSheet({ tab: "to-confirm" });
    }
  };
}
