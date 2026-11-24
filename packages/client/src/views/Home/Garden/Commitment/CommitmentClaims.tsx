import type { Address } from "@green-goods/shared/types/domain";
import {
  type CommitmentClaimRequestRecord,
  type CommitmentReadModel,
  type ServiceAccessSnapshot,
} from "@green-goods/shared/commitment-pooling";

import { type ClaimContext, ClaimContextSheet, type ClaimGardenOption } from "./ClaimContextSheet";
import { ClaimDecisionPanel } from "./ClaimDecisionPanel";
import { CommitmentClaimPanel } from "./CommitmentClaimPanel";

export interface CommitmentClaimsProps {
  commitment: CommitmentReadModel;
  acceptancePolicy?: ServiceAccessSnapshot["acceptancePolicy"];
  viewer: Address | null;
  /** The reader's own most recent request, if any. */
  ownRequest: CommitmentClaimRequestRecord | null;
  /** Requests still waiting for the pool garden's steward. */
  pendingRequests: CommitmentClaimRequestRecord[];
  /** Whether asking again is an open act right now. */
  canAskAgain: boolean;
  /** Steward of the garden that owns the pool: decides pending requests. */
  stewardsPoolGarden: boolean;
  claimGardens: { member: ClaimGardenOption[]; stewarded: ClaimGardenOption[] };
  contextOpen: boolean;
  onContextOpenChange: (open: boolean) => void;
  isClaiming: boolean;
  isDeciding: boolean;
  onAskAgain: () => void;
  onContinue: (context: ClaimContext) => void;
  onBackToBrowse: () => void;
  onAccept: (claimant: Address) => void;
  onDecline: (claimant: Address, reason: string) => void;
}

/**
 * The claim lifecycle on one commitment, both sides of it: the reader's own
 * request as it moves, the steward's decisions on everyone else's, and the
 * context sheet that scopes a protocol-pool claim to a garden.
 */
export function CommitmentClaims({
  commitment,
  acceptancePolicy,
  viewer,
  ownRequest,
  pendingRequests,
  canAskAgain,
  stewardsPoolGarden,
  claimGardens,
  contextOpen,
  onContextOpenChange,
  isClaiming,
  isDeciding,
  onAskAgain,
  onContinue,
  onBackToBrowse,
  onAccept,
  onDecline,
}: CommitmentClaimsProps) {
  const earned = acceptancePolicy?.kind === "earned" ? acceptancePolicy.earned : null;
  const canAccept =
    !earned ||
    (earned.status === "bound" && earned.terms !== null && earned.modulePaused === false);
  return (
    <>
      {ownRequest && viewer ? (
        <CommitmentClaimPanel
          commitment={commitment}
          request={ownRequest}
          viewer={viewer}
          canAskAgain={canAskAgain}
          isPending={isClaiming}
          onAskAgain={onAskAgain}
          onBackToBrowse={onBackToBrowse}
        />
      ) : null}

      {stewardsPoolGarden ? (
        <ClaimDecisionPanel
          requests={pendingRequests}
          isPending={isDeciding}
          canAccept={canAccept}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      ) : null}

      <ClaimContextSheet
        open={contextOpen}
        onOpenChange={onContextOpenChange}
        memberGardens={claimGardens.member}
        stewardedGardens={claimGardens.stewarded}
        approvalGated={commitment.claimMode === "APPROVAL_GATED"}
        isPending={isClaiming}
        onContinue={onContinue}
      />
    </>
  );
}
