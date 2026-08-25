import type {
  CommitmentCreationPayload,
  CommitmentJobKind,
  CommitmentJobPayloadMap,
} from "../commitment-pooling/jobs";

function commitmentPayload(payload: CommitmentCreationPayload) {
  return {
    poolId: payload.poolId,
    cycleId: payload.cycleId,
    creationRequestKey: payload.creationRequestKey,
    commitmentSeriesId: payload.commitmentSeriesId,
    direction: payload.direction,
    commitmentType: payload.commitmentType,
    claimType: payload.claimType,
    claimMode: payload.claimMode,
    contributorPolicy: payload.contributorPolicy,
    onBehalfOf: payload.onBehalfOf,
    domainTags: payload.domainTags,
    requirements: payload.requirements,
    unitLabel: payload.unitLabel,
    targetUnits: payload.targetUnits,
    requiresAssessment: payload.requiresAssessment,
    dueDate: payload.dueDate,
    metadataCID: payload.metadataCID,
    needUID: payload.needUID,
    counterCommitmentId: payload.counterCommitmentId,
    confirmers: payload.confirmers,
    confirmationThreshold: payload.confirmationThreshold,
    protocolFallbackEnabled: payload.protocolFallbackEnabled,
    consideration: payload.consideration,
    declaredUnitValue: payload.declaredUnitValue,
    declaredValueBasis: payload.declaredValueBasis,
  };
}

export function buildCommitmentContractCall(
  kind: CommitmentJobKind,
  payload: CommitmentJobPayloadMap[CommitmentJobKind]
) {
  switch (kind) {
    case "commitmentSeries": {
      const value = payload as CommitmentJobPayloadMap["commitmentSeries"];
      return {
        functionName: "createCommitmentSeries",
        args: [value.poolId, value.creationRequestKey, value.metadataCID] as const,
      };
    }
    case "commitment":
      return {
        functionName: "createCommitment",
        args: [commitmentPayload(payload as CommitmentCreationPayload)] as const,
      };
    case "claim": {
      const value = payload as CommitmentJobPayloadMap["claim"];
      return {
        functionName: "claimCommitment",
        args: [value.commitmentId, value.kind, value.gardenContext] as const,
      };
    }
    case "evidence": {
      const value = payload as CommitmentJobPayloadMap["evidence"];
      return {
        functionName: "attachEvidence",
        args: [value.commitmentId, value.cid, value.creditedContributors] as const,
      };
    }
    case "workLink": {
      const value = payload as CommitmentJobPayloadMap["workLink"];
      return {
        functionName: "linkWork",
        args: [
          value.commitmentId,
          value.workUID,
          value.requirementIndex,
          value.operationKey,
        ] as const,
      };
    }
    case "confirmation": {
      const value = payload as CommitmentJobPayloadMap["confirmation"];
      return {
        functionName: value.action === "submit" ? "submitForConfirmation" : "confirmFulfillment",
        args: [value.commitmentId] as const,
      };
    }
  }
}
