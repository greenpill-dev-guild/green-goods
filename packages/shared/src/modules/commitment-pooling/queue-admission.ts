import type { JobKindMap } from "../../types/job-queue";
import type { Address } from "../../types/domain";
import type { JobAdmission } from "../job-queue/ports";
import {
  COMMITMENT_JOB_KINDS,
  prepareCommitmentJobPayload,
  type CommitmentJobKind,
  type CommitmentJobPayloadMap,
} from "./jobs";

interface CommitmentAdmissionDependencies {
  isAvailable(chainId: number): boolean;
  moduleAddress(chainId: number): Address;
  isUndeployed(address: Address): boolean;
}

export function createCommitmentQueueAdmission(
  dependencies: CommitmentAdmissionDependencies
): JobAdmission {
  return {
    prepare<K extends keyof JobKindMap>({
      kind,
      payload,
      chainId,
      userAddress,
    }: {
      kind: K;
      payload: JobKindMap[K];
      chainId: number;
      userAddress: string;
    }): JobKindMap[K] {
      if (!COMMITMENT_JOB_KINDS.includes(kind as CommitmentJobKind)) return payload;
      if (!dependencies.isAvailable(chainId)) {
        throw new Error("Commitment Pooling is unavailable on this chain");
      }
      const moduleAddress = dependencies.moduleAddress(chainId);
      if (dependencies.isUndeployed(moduleAddress)) {
        throw new Error("Commitment Pooling is not deployed on this chain");
      }
      return prepareCommitmentJobPayload({
        kind: kind as CommitmentJobKind,
        payload: payload as CommitmentJobPayloadMap[CommitmentJobKind],
        chainId,
        moduleAddress,
        userAddress: userAddress as Address,
      }) as JobKindMap[K];
    },
  };
}
