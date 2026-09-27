/**
 * useCommitmentViewerRoles Hook
 *
 * Who the reader is, relative to one commitment and the gardens around it.
 *
 * Every act on a commitment is gated by a hat somewhere, and on the protocol
 * pool "somewhere" is rarely the route: the route names the host garden, the
 * record names the provider's garden and the garden that took an offer up,
 * and a claim is scoped to a garden of the claimant's own. This hook reads
 * all of those once, from chain, so the screen asks one question per act
 * instead of five hook calls per render.
 *
 * @module hooks/commitment-pooling/useCommitmentViewerRoles
 */

import { useMemo } from "react";

import type {
  CommitmentPoolRecord,
  CommitmentReadModel,
} from "../../modules/commitment-pooling/types";
import type { Address, Garden } from "../../types/domain";
import { isAddressInList } from "../../utils/blockchain/address";
import { useGardens } from "../blockchain/useBaseLists";
import { isGardenMember, usePendingJoinsVersion } from "../garden/useJoinGarden";
import { useGardenPermissions } from "../garden/useGardenPermissions";
import { useGardenMembership } from "../roles/useGardenMembership";
import { useHasRole } from "../roles/useHasRole";

const NO_GARDENS: Garden[] = [];

/**
 * Whether the roster names the viewer in any of the six roles, with the join
 * overlay for a gardener whose join landed before the indexer caught up. The
 * contract counts every hat (`GuardLib.isGardenMember`), so evaluators, owners,
 * funders and community members are members too.
 */
function holdsRosterRole(viewer: Address | null | undefined, garden: Garden): boolean {
  if (isGardenMember(viewer, garden.gardeners, garden.stewards, garden.id)) return true;
  return [garden.evaluators, garden.owners, garden.funders, garden.communities].some((list) =>
    isAddressInList(viewer, list)
  );
}

export interface ClaimGardenOption {
  address: Address;
  name: string;
}

export interface CommitmentViewerRoles {
  /** Steward or owner of the route garden. */
  isSteward: boolean;
  /** Steward of the garden that owns the commitment's pool. Gates accept/decline and Not yet. */
  stewardsPoolGarden: boolean;
  /** On an Offer a garden took up, that garden; undefined otherwise. */
  counterpartyGarden: Address | undefined;
  /** Steward or owner of that garden: the ordinary confirmer for it. */
  stewardsCounterparty: boolean;
  /** The route garden's record, when the list has it. */
  garden: Garden | undefined;
  /**
   * Holds a role in the route garden: what the contract rosters. True from the
   * chain's six-role read, a steward or owner hat, or the indexer's roster in
   * any role with the pending-join overlay, so a join counts the moment it
   * lands. Null until both the chain read and the garden list have answered,
   * and while either failed, so a screen offers nothing rather than the wrong
   * thing.
   */
  isMemberHere: boolean | null;
  /** Gardens the reader may claim through or for, with the pool's host left out. */
  claimGardens: { member: ClaimGardenOption[]; stewarded: ClaimGardenOption[] };
  /** True only once the garden list has been read, so an empty list means "none". */
  claimGardensKnown: boolean;
  /** A read membership depends on failed: the garden list, or the chain's role reads. */
  membershipUnavailable: boolean;
  /** Read the garden list and the chain's role reads again after a failure. */
  retryMembership: () => void;
}

export function useCommitmentViewerRoles(input: {
  chainId: number;
  viewer: Address | null | undefined;
  routeGarden: string | undefined;
  commitment:
    | Pick<CommitmentReadModel, "direction" | "counterpartyKind" | "counterparty">
    | undefined;
  pool: Pick<CommitmentPoolRecord, "garden"> | null | undefined;
}): CommitmentViewerRoles {
  const { chainId, viewer, routeGarden, commitment, pool } = input;
  const who = (viewer ?? undefined) as Address | undefined;
  const route = routeGarden as Address | undefined;

  const { hasRole: wearsStewardHat } = useHasRole(route, who, "steward", chainId);
  const { hasRole: isOwner } = useHasRole(route, who, "owner", chainId);
  // Every role the contract accepts, read strictly: a failed read is unknown.
  const chainMembership = useGardenMembership(route, who, chainId);
  const { hasRole: stewardsPoolGarden } = useHasRole(
    pool?.garden as Address | undefined,
    who,
    "steward",
    chainId
  );

  const counterpartyGarden =
    commitment?.direction === "OFFER" && commitment.counterpartyKind === "GARDEN"
      ? (commitment.counterparty ?? undefined)
      : undefined;
  const { hasRole: stewardsCp } = useHasRole(counterpartyGarden, who, "steward", chainId);
  const { hasRole: ownsCp } = useHasRole(counterpartyGarden, who, "owner", chainId);

  const gardensQuery = useGardens();
  const gardens = gardensQuery.data ?? NO_GARDENS;
  // Known only on a successful read: a failed query also stops loading and
  // hands back an empty list, which would otherwise read as "a member of none".
  const gardensKnown = gardensQuery.isSuccess;
  const { canManageGarden } = useGardenPermissions();
  // A join written in this tab lands in the overlay before the roster; the
  // version ticks when it does, so the memo below sees it without a reload.
  const pendingJoinsVersion = usePendingJoinsVersion();
  const garden = gardens.find((entry) => entry.id.toLowerCase() === routeGarden?.toLowerCase());

  // The contract refuses the host as a garden-claim context
  // (GardenClaimMustBeExternal) and gates a personal claim on membership in
  // the chosen context, so the host is left out of both lists.
  const poolHost = pool?.garden?.toLowerCase();
  const claimGardens = useMemo(() => {
    void pendingJoinsVersion;
    const others = gardens.filter((entry) => entry.id.toLowerCase() !== poolHost);
    const asOption = (entry: Garden): ClaimGardenOption => ({
      address: entry.id as Address,
      name: entry.name,
    });
    return {
      member: others.filter((entry) => holdsRosterRole(viewer, entry)).map(asOption),
      stewarded: others.filter((entry) => canManageGarden(entry)).map(asOption),
    };
  }, [gardens, poolHost, viewer, canManageGarden, pendingJoinsVersion]);

  const isSteward = wearsStewardHat || isOwner;
  // Read on every render on purpose: the overlay lives in localStorage, and a
  // render is the cheapest way to see a join whichever surface wrote it.
  const rosterOrOverlay = garden ? holdsRosterRole(viewer, garden) : false;
  const chainPending = chainMembership.isLoading || chainMembership.isError;
  const isMemberHere: boolean | null =
    isSteward || chainMembership.isMember === true || rosterOrOverlay
      ? true
      : chainPending || !gardensKnown
        ? null
        : false;

  return {
    isSteward,
    isMemberHere,
    stewardsPoolGarden,
    counterpartyGarden,
    stewardsCounterparty: stewardsCp || ownsCp,
    garden,
    claimGardens,
    claimGardensKnown: gardensKnown,
    membershipUnavailable:
      gardensQuery.isError || (chainMembership.isError && isMemberHere !== true),
    retryMembership: () => {
      void gardensQuery.refetch();
      chainMembership.refetch();
    },
  };
}
