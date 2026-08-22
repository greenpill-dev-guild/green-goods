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
import { useGardens } from "../blockchain/useBaseLists";
import { isGardenMember } from "../garden/useJoinGarden";
import { useGardenPermissions } from "../garden/useGardenPermissions";
import { useHasRole } from "../roles/useHasRole";

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
  /** Holds any role in the route garden: what the contract rosters. */
  isMemberHere: boolean;
  /** Gardens the reader may claim through or for, with the pool's host left out. */
  claimGardens: { member: ClaimGardenOption[]; stewarded: ClaimGardenOption[] };
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

  const { hasRole: isOperator } = useHasRole(route, who, "operator", chainId);
  const { hasRole: isOwner } = useHasRole(route, who, "owner", chainId);
  const { hasRole: stewardsPoolGarden } = useHasRole(
    pool?.garden as Address | undefined,
    who,
    "operator",
    chainId
  );

  const counterpartyGarden =
    commitment?.direction === "OFFER" && commitment.counterpartyKind === "GARDEN"
      ? (commitment.counterparty ?? undefined)
      : undefined;
  const { hasRole: stewardsCp } = useHasRole(counterpartyGarden, who, "operator", chainId);
  const { hasRole: ownsCp } = useHasRole(counterpartyGarden, who, "owner", chainId);

  const { data: gardens = [] } = useGardens();
  const { canManageGarden } = useGardenPermissions();
  const garden = gardens.find((entry) => entry.id.toLowerCase() === routeGarden?.toLowerCase());

  // The contract refuses the host as a garden-claim context
  // (GardenClaimMustBeExternal) and gates a personal claim on membership in
  // the chosen context, so the host is left out of both lists.
  const poolHost = pool?.garden?.toLowerCase();
  const claimGardens = useMemo(() => {
    const others = gardens.filter((entry) => entry.id.toLowerCase() !== poolHost);
    const asOption = (entry: Garden): ClaimGardenOption => ({
      address: entry.id as Address,
      name: entry.name,
    });
    return {
      member: others
        .filter((entry) => isGardenMember(viewer, entry.gardeners, entry.operators))
        .map(asOption),
      stewarded: others.filter((entry) => canManageGarden(entry)).map(asOption),
    };
  }, [gardens, poolHost, viewer, canManageGarden]);

  const isSteward = isOperator || isOwner;
  return {
    isSteward,
    isMemberHere: isSteward || isGardenMember(viewer, garden?.gardeners, garden?.operators),
    stewardsPoolGarden,
    counterpartyGarden,
    stewardsCounterparty: stewardsCp || ownsCp,
    garden,
    claimGardens,
  };
}
