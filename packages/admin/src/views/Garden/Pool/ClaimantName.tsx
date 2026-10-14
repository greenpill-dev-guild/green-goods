import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import type { CommitmentClaimRequestRecord } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { PersonName } from "@/components/PersonName";

/**
 * Who a claim is for, as the steward knows them: a garden by its name, a
 * person by their Green Goods name, then ENS, then a short address. A bare
 * address says nothing about who is asking, and two requests on one commitment
 * must be told apart before one is approved over the other. Every name takes
 * one style, 14px semibold (PRD-1025 D11), with the full address on hover.
 */
export function ClaimantName({
  claim,
  chainId,
  className,
}: {
  claim: Pick<CommitmentClaimRequestRecord, "claimant" | "claimType">;
  chainId: number;
  className?: string;
}) {
  const { data: gardens } = useGardens(chainId);
  if (claim.claimType === "GARDEN") {
    const key = claim.claimant.toLowerCase();
    const garden = gardens?.find((entry) => entry.id.toLowerCase() === key);
    if (garden) {
      return (
        <span
          data-component="ClaimantName"
          className={cn("truncate body-sm font-semibold text-text-strong", className)}
          title={`${garden.name} · ${claim.claimant}`}
        >
          {garden.name}
        </span>
      );
    }
  }
  return <PersonName address={claim.claimant} className={className} />;
}
