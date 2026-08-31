/**
 * Garden commitment controller
 *
 * Composes the detail screen's readers and mutations once so the client view
 * renders a model instead of rebuilding domain authority and queue rules.
 *
 * @module hooks/client-ui/commitment/useGardenCommitmentController
 */

import type { Hex } from "viem";

import {
  canJoinTeam,
  canLinkWork,
  selectCommitmentActKind,
} from "../../../modules/commitment-pooling/acts";
import { isCommitmentReasonPinError } from "../../../modules/commitment-pooling/reasons";
import { selectCommitmentSeat } from "../../../modules/commitment-pooling/selectors";
import type { Address } from "../../../types/domain";
import { useOffline } from "../../app/useOffline";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useActions } from "../../blockchain/useBaseLists";
import { useCommitmentJobs } from "../../commitment-pooling/useCommitmentJobs";
import { useCommitmentMetadataFor } from "../../commitment-pooling/useCommitmentMetadata";
import { useCommitmentMutation } from "../../commitment-pooling/useCommitmentMutations";
import {
  useCommitment,
  useCommitmentClaimRequests,
  useCommitmentPool,
  useLinkedWorkUIDs,
} from "../../commitment-pooling/useCommitmentPooling";
import { useCommitmentQueueState } from "../../commitment-pooling/useCommitmentQueueState";
import { useCommitmentViewerRoles } from "../../commitment-pooling/useCommitmentViewerRoles";
import { useCommitmentWorkDecisions } from "../../commitment-pooling/useCommitmentWorkDecisions";
import { useWorks } from "../../work/useWorks";
import type {
  GardenCommitmentActs,
  GardenCommitmentController,
  GardenCommitmentStatus,
} from "./controller.types";

const CLAIM_TYPE_GARDEN = 0;
const CLAIM_TYPE_INDIVIDUAL = 1;

function missingRecord(): never {
  throw new Error("The commitment is not ready");
}

export function useGardenCommitmentController(input: {
  chainId: number;
  commitmentId: bigint | null;
  routeGarden: string | undefined;
}): GardenCommitmentController {
  const { chainId, commitmentId, routeGarden: routeGardenInput } = input;
  const routeGarden = (routeGardenInput as Address | undefined) ?? null;
  const { isOnline } = useOffline();
  const viewer = (usePrimaryAddress() as Address | null) ?? null;
  const commitmentQuery = useCommitment(
    { chainId, commitmentId: commitmentId ?? 0n },
    { enabled: commitmentId !== null }
  );
  const jobs = useCommitmentJobs({ chainId });
  const queueState = useCommitmentQueueState(viewer);
  const metadata = useCommitmentMetadataFor(commitmentQuery.detail?.commitment);
  const mutation = useCommitmentMutation({ chainId });
  const workGarden = commitmentQuery.detail?.commitment.providerGarden ?? null;
  const { works } = useWorks(workGarden ?? "", { offline: true });
  const poolQuery = useCommitmentPool(
    { chainId, poolId: commitmentQuery.detail?.commitment.poolId ?? 0n },
    { enabled: Boolean(commitmentQuery.detail?.commitment.poolId) }
  );
  const roles = useCommitmentViewerRoles({
    chainId,
    viewer,
    routeGarden: routeGardenInput,
    commitment: commitmentQuery.detail?.commitment,
    pool: poolQuery.pool,
  });
  const claimsQuery = useCommitmentClaimRequests({
    chainId,
    commitmentId: commitmentId ?? 0n,
  });
  const { data: actions = [] } = useActions(chainId);

  const detail = commitmentQuery.detail;
  const commitment = detail?.commitment;
  const workDecisions = useCommitmentWorkDecisions({
    chainId,
    garden: commitment?.providerGarden ?? routeGarden,
    commitmentId,
    attributions: detail?.workAttributions ?? [],
    enabled: Boolean(detail),
  });
  const ownWorkUIDs = works
    .filter((work) => viewer && work.gardenerAddress.toLowerCase() === viewer.toLowerCase())
    .map((work) => work.id);
  const { linked: linkedElsewhere } = useLinkedWorkUIDs({ chainId, workUIDs: ownWorkUIDs });

  const seat = detail
    ? selectCommitmentSeat({
        commitment: detail.commitment,
        contributors: detail.contributors
          .filter((contributor) => contributor.active)
          .map((contributor) => contributor.contributor),
        viewer: viewer ?? undefined,
        stewardedGardens:
          roles.counterpartyGarden && roles.stewardsCounterparty ? [roles.counterpartyGarden] : [],
      })
    : null;
  const queueKey = commitment?.commitmentId.toString() ?? "";
  const pending = Boolean(commitment && queueState.pendingCommitmentIds.has(queueKey));
  const sendFailed = Boolean(commitment && queueState.failedCommitmentIds.has(queueKey));
  const ownRequest = viewer
    ? (claimsQuery.claimRequests
        .filter(
          (request) =>
            request.requestedBy.toLowerCase() === viewer.toLowerCase() ||
            request.claimant.toLowerCase() === viewer.toLowerCase()
        )
        .sort((left, right) => right.requestedAt - left.requestedAt)[0] ?? null)
    : null;
  const pendingClaimRequests = claimsQuery.claimRequests.filter(
    (request) => request.state === "PENDING"
  );
  const hasPendingClaimRequest = ownRequest?.state === "PENDING";
  const actKind = commitment
    ? selectCommitmentActKind({
        commitment,
        seat,
        hasPendingJob: pending || hasPendingClaimRequest || queueState.isUnavailable,
      })
    : null;
  const actGarden = commitment ? (commitment.providerGarden as Address | null) : null;
  const joinable = commitment
    ? canJoinTeam({ commitment, seat, isGardenMember: roles.isMemberHere })
    : false;
  const linkable = commitment
    ? canLinkWork({
        commitment,
        seat,
        linkedCount: detail?.workAttributions.filter((entry) => entry.linked).length ?? 0,
      })
    : false;
  const linkableWorks = works.filter(
    (work) =>
      viewer &&
      work.gardenerAddress.toLowerCase() === viewer.toLowerCase() &&
      (work.status === "approved" || work.status === "pending") &&
      !linkedElsewhere.has(work.id.toLowerCase())
  );
  const membershipNotRequired = Boolean(
    viewer && commitment?.confirmers?.some((entry) => entry.toLowerCase() === viewer.toLowerCase())
  );
  const confirmationGarden = roles.counterpartyGarden ?? routeGarden;
  const canNotYet = Boolean(
    viewer &&
      commitment &&
      (commitment.creator?.toLowerCase() === viewer.toLowerCase() ||
        commitment.counterparty?.toLowerCase() === viewer.toLowerCase() ||
        membershipNotRequired ||
        roles.stewardsPoolGarden)
  );
  const confirmed =
    commitment?.derivedState === "FULFILLED" || commitment?.derivedState === "RECONCILED";

  let status: GardenCommitmentStatus = "ready";
  if (commitmentQuery.availability.status !== "available") status = "unavailable";
  else if (!commitmentId || (!commitmentQuery.isLoading && !detail && !commitmentQuery.isError))
    status = "notFound";
  else if (commitmentQuery.isLoading) status = "loading";
  else if (commitmentQuery.isError || !detail) status = "error";

  const requireCommitment = () => commitment ?? missingRecord();
  const requireRouteGarden = () => routeGarden ?? missingRecord();
  const requireActGarden = () => actGarden ?? missingRecord();
  const requireWorkGarden = () => workGarden ?? missingRecord();
  const requireConfirmationGarden = () => confirmationGarden ?? missingRecord();
  const acts: GardenCommitmentActs = {
    claim: (context) =>
      jobs.enqueue({
        act: "claim",
        payload: {
          commitmentId: requireCommitment().commitmentId,
          kind: context.kind === "garden" ? CLAIM_TYPE_GARDEN : CLAIM_TYPE_INDIVIDUAL,
          gardenContext: context.garden,
          gardenAddress: context.garden,
        },
      }),
    claimPersonal: () => {
      const garden = requireRouteGarden();
      return jobs.enqueue({
        act: "claim",
        payload: {
          commitmentId: requireCommitment().commitmentId,
          kind: CLAIM_TYPE_INDIVIDUAL,
          gardenContext: garden,
          gardenAddress: garden,
        },
      });
    },
    linkWork: (workUID, requirementIndex, clientOperationId) =>
      jobs.enqueue({
        act: "workLink",
        payload: {
          clientOperationId,
          commitmentId: requireCommitment().commitmentId,
          workUID: workUID as Hex,
          requirementIndex,
          gardenAddress: requireWorkGarden(),
        },
      }),
    sendForConfirmation: () =>
      jobs.enqueue({
        act: "sendForConfirmation",
        commitmentId: requireCommitment().commitmentId,
        gardenAddress: requireActGarden(),
      }),
    confirm: () =>
      jobs.enqueue({
        act: "confirm",
        commitmentId: requireCommitment().commitmentId,
        gardenAddress: requireConfirmationGarden(),
        membershipNotRequired,
      }),
    notYet: (reason) =>
      mutation.mutateAsync({
        action: "raiseDispute",
        commitmentId: requireCommitment().commitmentId,
        reason,
        gardenAddress: requireRouteGarden(),
      }),
    join: () =>
      mutation.mutateAsync({
        action: "joinCommitment",
        commitmentId: requireCommitment().commitmentId,
      }),
    withdraw: (reason) =>
      mutation.mutateAsync({
        action: "cancelCommitment",
        commitmentId: requireCommitment().commitmentId,
        reason,
        gardenAddress: requireRouteGarden(),
      }),
    acceptClaim: (claimant) =>
      mutation.mutateAsync({
        action: "acceptClaim",
        commitmentId: requireCommitment().commitmentId,
        claimant,
      }),
    declineClaim: (claimant, reason) =>
      mutation.mutateAsync({
        action: "declineClaim",
        commitmentId: requireCommitment().commitmentId,
        claimant,
        reason,
        gardenAddress: requireRouteGarden(),
      }),
  };

  return {
    chainId,
    routeGarden,
    workGarden,
    viewer,
    isOnline,
    status,
    availability: commitmentQuery.availability,
    detail,
    metadata,
    pool: poolQuery.pool,
    works,
    actions,
    roles,
    seat,
    actGarden,
    actKind,
    joinable,
    linkable,
    linkableWorks,
    workDecisions: {
      decisions: workDecisions.decisions,
      byWorkUID: workDecisions.byWorkUID,
      isLoading: workDecisions.isLoading,
      isError: workDecisions.isError,
      readAvailable: workDecisions.readAvailable,
      refetch: workDecisions.refetch,
    },
    ownRequest,
    pendingClaimRequests,
    canAskAgain: Boolean(
      commitment &&
        (commitment.derivedState === "OFFERED" || commitment.derivedState === "REQUESTED") &&
        !pending &&
        !queueState.isUnavailable
    ),
    claimNeedsContext: poolQuery.pool?.poolType === "PROTOCOL",
    queue: {
      hasPendingJob: pending,
      sendFailed,
      failedJob: queueState.failedJobs.get(queueKey) ?? null,
      isUnavailable: queueState.isUnavailable,
      refresh: queueState.refresh,
    },
    confirmation: {
      phase: confirmed ? "confirmed" : pending ? "pending" : "ask",
      canNotYet,
      gardenAddress: confirmationGarden,
      membershipNotRequired,
    },
    pinFailed: isCommitmentReasonPinError(mutation.error),
    isQueueing: jobs.isPending,
    isSending: mutation.isPending,
    acts,
    refetch: commitmentQuery.refetch,
  };
}
