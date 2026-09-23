import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import type { CommitmentClaimRequestRecord } from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { Address } from "@green-goods/shared/types/domain";

/**
 * Who a claim is for, as the steward knows them: a garden by its name, a
 * person by their resolved name. A bare address says nothing about who is
 * asking, and two requests on one commitment must be told apart before one is
 * accepted over the other.
 */
export function ClaimantName({
  claim,
  chainId,
}: {
  claim: Pick<CommitmentClaimRequestRecord, "claimant" | "claimType">;
  chainId: number;
}) {
  const { data: gardens } = useGardens(chainId);
  if (claim.claimType === "GARDEN") {
    const key = claim.claimant.toLowerCase();
    const garden = gardens?.find((entry) => entry.id.toLowerCase() === key);
    if (garden) {
      return (
        <span className="font-medium text-text-strong" title={claim.claimant}>
          {garden.name}
        </span>
      );
    }
  }
  return <AddressDisplay address={claim.claimant as Address} interactive={false} />;
}
