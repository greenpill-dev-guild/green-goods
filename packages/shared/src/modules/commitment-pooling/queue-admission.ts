import type { JobKindMap, WorkJobPayload } from "../../types/job-queue";
import type { Address } from "../../types/domain";
import type { JobAdmission } from "../job-queue/ports";
import {
  COMMITMENT_JOB_KINDS,
  prepareCommitmentJobPayload,
  type CommitmentJobKind,
  type CommitmentJobPayloadMap,
} from "./jobs";
import { dependentWorkLinkPayload, fromDraftWorkLink } from "./work-link-intent";
import { compareAddresses } from "../../utils/blockchain/address";

interface CommitmentAdmissionDependencies {
  isAvailable(chainId: number): boolean;
  moduleAddress(chainId: number): Address;
  isUndeployed(address: Address): boolean;
}

export function createCommitmentQueueAdmission(
  dependencies: CommitmentAdmissionDependencies
): JobAdmission {
  const admission: JobAdmission = {
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
      if (kind === "work") {
        const { linkIntent, ...work } = payload as WorkJobPayload;
        if (!linkIntent) return work as JobKindMap[K];
        const link = fromDraftWorkLink(linkIntent);
        if (
          !link ||
          !work.clientWorkId ||
          link.actionUID !== work.actionUID ||
          !compareAddresses(link.garden, work.gardenAddress)
        )
          throw new Error("work-link-intent-mismatch");
        return {
          ...work,
          dependentWorkLink: admission.prepare({
            kind: "workLink",
            payload: dependentWorkLinkPayload(
              work.clientWorkId,
              link
            ) as CommitmentJobPayloadMap["workLink"],
            chainId,
            userAddress,
          }),
        } as JobKindMap[K];
      }
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
  return admission;
}
