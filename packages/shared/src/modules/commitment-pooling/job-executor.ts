import type { Hex } from "viem";
import {
  hashCommitmentCreationPayload,
  hashSeriesCreationPayload,
  hashWorkLinkPayload,
} from "./job-identity";
import type {
  CommitmentCreationPayload,
  CommitmentJob,
  EvidenceJobPayload,
  CommitmentJobExecutionDependencies,
  CommitmentJobExecutionResult,
  CommitmentJobKind,
  CommitmentJobPayloadMap,
  CommitmentSeriesJobPayload,
  WorkLinkJobPayload,
} from "./job-types";

const ZERO_HASH = `0x${"00".repeat(32)}` as Hex;

export async function executeCommitmentJob<K extends CommitmentJobKind>(
  job: CommitmentJob<K>,
  dependencies: CommitmentJobExecutionDependencies
): Promise<CommitmentJobExecutionResult> {
  if (job.kind === "commitmentSeries") {
    const payload = job.payload as CommitmentSeriesJobPayload;
    const existingId = await dependencies.readSeriesId(job.userAddress, payload.creationRequestKey);
    if (existingId !== 0n) {
      const [series, poolGarden] = await Promise.all([
        dependencies.readSeries(existingId),
        dependencies.readPoolGarden(payload.poolId),
      ]);
      const matches =
        series.poolId === payload.poolId &&
        series.createdBy.toLowerCase() === job.userAddress.toLowerCase() &&
        poolGarden.toLowerCase() === payload.gardenAddress.toLowerCase() &&
        series.creationPayloadHash ===
          hashSeriesCreationPayload(payload.poolId, payload.metadataCID);
      return matches
        ? { status: "recovered", entityId: existingId }
        : { status: "identity-conflict", reason: "series-payload-mismatch" };
    }
    if (job.submittedTxHash) return { status: "waiting", reason: "pending-first-send" };
  }

  if (job.kind === "commitment") {
    const payload = job.payload as CommitmentCreationPayload;
    if (payload.commitmentSeriesClientId && payload.commitmentSeriesId === 0n) {
      const seriesId = await dependencies.resolveSeriesId?.(payload.commitmentSeriesClientId);
      if (!seriesId) return { status: "waiting", reason: "series-not-materialized" };
      payload.commitmentSeriesId = seriesId;
    }
    const existingId = await dependencies.readCommitmentId(
      job.userAddress,
      payload.creationRequestKey
    );
    if (existingId !== 0n) {
      const existing = await dependencies.readCommitment(existingId);
      const expectedHash = hashCommitmentCreationPayload(payload);
      const matches =
        existing.poolId === payload.poolId &&
        existing.creator.toLowerCase() === job.userAddress.toLowerCase() &&
        existing.creationPayloadHash === expectedHash;
      return matches
        ? { status: "recovered", entityId: existingId }
        : { status: "identity-conflict", reason: "commitment-payload-mismatch" };
    }
    if (job.submittedTxHash) return { status: "waiting", reason: "pending-first-send" };
  }

  if (job.kind === "workLink") {
    const payload = job.payload as WorkLinkJobPayload;
    const workUID = payload.workUID ?? payload.resolvedWorkUID;
    if (!workUID) return { status: "waiting", reason: "work-not-indexed" };
    // Recovery must precede live commitment preflights. A successful first send
    // can itself advance/freeze the commitment before the local receipt lands.
    const stored = await dependencies.readWorkLinkPayloadHash(
      job.userAddress,
      payload.operationKey
    );
    if (stored !== ZERO_HASH) {
      return stored === hashWorkLinkPayload(payload.commitmentId, workUID, payload.requirementIndex)
        ? { status: "recovered" }
        : { status: "identity-conflict", reason: "work-link-payload-mismatch" };
    }
    if (dependencies.readWorkLinkCommitmentState) {
      const commitment = await dependencies.readWorkLinkCommitmentState(payload.commitmentId);
      if (commitment.contributorsFrozen) {
        return { status: "identity-conflict", reason: "commitment-frozen" };
      }
      // ICommitmentPoolingModule.CommitmentState.Accepted
      if (commitment.state !== 3) {
        return { status: "identity-conflict", reason: "commitment-terminal" };
      }
    }
  }

  if (job.kind === "evidence") {
    const payload = job.payload as EvidenceJobPayload;
    if (!payload.cid) {
      // The document has not been published; attaching nothing is not an option
      // and attaching the wrong thing is worse. The queue's publish step fills
      // the CID in before this runs, so reaching here means it has not yet.
      return { status: "waiting", reason: "evidence-unpublished" };
    }
    // A send that broadcast and then threw leaves the proof on chain and the
    // job unsynced; re-sending reverts EvidenceAlreadyAttached and, after
    // enough tries, records a failure for something that landed. The chain
    // is asked first, the way creations and work links are.
    if (dependencies.readEvidenceAttached) {
      if (await dependencies.readEvidenceAttached(payload.commitmentId, payload.cid)) {
        return { status: "recovered" };
      }
    }
  }

  // A named confirmer is authorized by the list on the commitment, not by any
  // hat, so a membership wait would hold an act the chain already accepts.
  const byIdentity =
    "membershipNotRequired" in job.payload && job.payload.membershipNotRequired === true;
  if (dependencies.hasMembership && !byIdentity) {
    const garden = "gardenAddress" in job.payload ? job.payload.gardenAddress : undefined;
    if (garden) {
      const membership = await dependencies.hasMembership(garden, job.userAddress);
      if (membership === null) return { status: "waiting", reason: "membership-unavailable" };
      if (membership === false) {
        return job.kind === "workLink"
          ? { status: "identity-conflict", reason: "membership-lost" }
          : { status: "waiting", reason: "membership-unavailable" };
      }
    }
  }

  const txHash = await dependencies.send({
    kind: job.kind,
    payload: job.payload as CommitmentJobPayloadMap[CommitmentJobKind],
    chainId: job.chainId,
    moduleAddress: job.moduleAddress,
  });
  return { status: "sent", txHash };
}
