import type { Hex } from "viem";
import {
  hashCommitmentCreationPayload,
  hashSeriesCreationPayload,
  hashWorkLinkPayload,
} from "./job-identity";
import type {
  CommitmentCreationPayload,
  CommitmentJob,
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
    const stored = await dependencies.readWorkLinkPayloadHash(
      job.userAddress,
      payload.operationKey
    );
    if (stored !== ZERO_HASH) {
      return stored ===
        hashWorkLinkPayload(payload.commitmentId, payload.workUID, payload.requirementIndex)
        ? { status: "recovered" }
        : { status: "identity-conflict", reason: "work-link-payload-mismatch" };
    }
  }

  if (dependencies.hasMembership) {
    const garden = "gardenAddress" in job.payload ? job.payload.gardenAddress : undefined;
    if (garden && (await dependencies.hasMembership(garden, job.userAddress)) !== true) {
      return { status: "waiting", reason: "membership-unavailable" };
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
