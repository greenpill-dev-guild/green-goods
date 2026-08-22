import {
  type Address,
  type CommitmentClaimRequestRecord,
  type CommitmentReadModel,
  useCommitmentMutation,
} from "@green-goods/shared";
import { useNavigate } from "react-router-dom";

import { type ClaimContext, ClaimContextSheet, type ClaimGardenOption } from "./ClaimContextSheet";
import { ClaimDecisionPanel } from "./ClaimDecisionPanel";
import { CommitmentClaimPanel } from "./CommitmentClaimPanel";

export interface CommitmentClaimsProps {
  commitment: CommitmentReadModel;
  claimRequests: CommitmentClaimRequestRecord[];
  viewer: Address | null;
  /** The reader's own most recent request, if any. */
  ownRequest: CommitmentClaimRequestRecord | null;
  /** Whether asking again is an open act right now. */
  canAskAgain: boolean;
  /** Steward of the garden that owns the pool: decides pending requests. */
  stewardsPoolGarden: boolean;
  claimGardens: { member: ClaimGardenOption[]; stewarded: ClaimGardenOption[] };
  contextOpen: boolean;
  onContextOpenChange: (open: boolean) => void;
  isPending: boolean;
  chainId: number;
  /** The route garden, for upload tracking on a decline's pinned reason. */
  gardenAddress: Address;
  onAskAgain: () => void;
  onContinue: (context: ClaimContext) => void;
}

/**
 * The claim lifecycle on one commitment, both sides of it: the reader's own
 * request as it moves, the steward's decisions on everyone else's, and the
 * context sheet that scopes a protocol-pool claim to a garden.
 */
export function CommitmentClaims({
  commitment,
  claimRequests,
  viewer,
  ownRequest,
  canAskAgain,
  stewardsPoolGarden,
  claimGardens,
  contextOpen,
  onContextOpenChange,
  isPending,
  chainId,
  gardenAddress,
  onAskAgain,
  onContinue,
}: CommitmentClaimsProps) {
  const navigate = useNavigate();
  const onlineMutation = useCommitmentMutation({ chainId });
  return (
    <>
      {ownRequest && viewer ? (
        <CommitmentClaimPanel
          commitment={commitment}
          request={ownRequest}
          viewer={viewer}
          canAskAgain={canAskAgain}
          isPending={isPending}
          onAskAgain={onAskAgain}
          onBackToBrowse={() => navigate("../..", { relative: "path" })}
        />
      ) : null}

      {stewardsPoolGarden ? (
        <ClaimDecisionPanel
          requests={claimRequests.filter((request) => request.state === "PENDING")}
          isPending={onlineMutation.isPending}
          onAccept={(claimant) =>
            onlineMutation.mutate({
              action: "acceptClaim",
              commitmentId: commitment.commitmentId,
              claimant,
            })
          }
          onDecline={(claimant, reason) =>
            onlineMutation.mutate({
              action: "declineClaim",
              commitmentId: commitment.commitmentId,
              claimant,
              reason,
              gardenAddress,
            })
          }
        />
      ) : null}

      <ClaimContextSheet
        open={contextOpen}
        onOpenChange={onContextOpenChange}
        memberGardens={claimGardens.member}
        stewardedGardens={claimGardens.stewarded}
        approvalGated={commitment.claimMode === "APPROVAL_GATED"}
        isPending={isPending}
        onContinue={onContinue}
      />
    </>
  );
}
