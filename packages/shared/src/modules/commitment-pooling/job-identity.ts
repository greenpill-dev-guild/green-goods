import {
  encodeAbiParameters,
  encodePacked,
  isAddress,
  keccak256,
  stringToBytes,
  type Hex,
} from "viem";
import type { Address } from "../../types/domain";
import type {
  CommitmentCreationPayload,
  CommitmentJobKind,
  CommitmentJobPayloadMap,
  CommitmentSeriesJobPayload,
  WorkLinkJobPayload,
} from "./job-types";

function identityKey(input: {
  domain: string;
  chainId: number;
  moduleAddress: Address;
  caller: Address;
  clientId: string;
}): Hex {
  if (!Number.isSafeInteger(input.chainId) || input.chainId <= 0) throw new Error("invalid chain");
  if (!isAddress(input.moduleAddress) || !isAddress(input.caller))
    throw new Error("invalid address");
  if (!input.clientId) throw new Error("client id is required");
  return keccak256(
    encodeAbiParameters(
      [
        { type: "string" },
        { type: "uint256" },
        { type: "address" },
        { type: "address" },
        { type: "string" },
      ],
      [input.domain, BigInt(input.chainId), input.moduleAddress, input.caller, input.clientId]
    )
  );
}

export function createSeriesCreationRequestKey(input: {
  chainId: number;
  moduleAddress: Address;
  holder: Address;
  clientSeriesId: string;
}): Hex {
  return identityKey({
    domain: "GREEN_GOODS_COMMITMENT_SERIES_V1",
    chainId: input.chainId,
    moduleAddress: input.moduleAddress,
    caller: input.holder,
    clientId: input.clientSeriesId,
  });
}

export function createCommitmentCreationRequestKey(input: {
  chainId: number;
  moduleAddress: Address;
  creator: Address;
  clientCommitmentId: string;
}): Hex {
  return identityKey({
    domain: "GREEN_GOODS_COMMITMENT_V1",
    chainId: input.chainId,
    moduleAddress: input.moduleAddress,
    caller: input.creator,
    clientId: input.clientCommitmentId,
  });
}

export function createWorkLinkOperationKey(input: {
  chainId: number;
  moduleAddress: Address;
  caller: Address;
  clientOperationId: string;
}): Hex {
  return identityKey({
    domain: "GREEN_GOODS_COMMITMENT_WORK_LINK_V1",
    chainId: input.chainId,
    moduleAddress: input.moduleAddress,
    caller: input.caller,
    clientId: input.clientOperationId,
  });
}

export function prepareCommitmentJobPayload<K extends CommitmentJobKind>(input: {
  kind: K;
  payload: CommitmentJobPayloadMap[K];
  chainId: number;
  moduleAddress: Address;
  userAddress: Address;
}): CommitmentJobPayloadMap[K] {
  switch (input.kind) {
    case "commitmentSeries": {
      const payload = input.payload as CommitmentSeriesJobPayload;
      return {
        ...payload,
        creationRequestKey: createSeriesCreationRequestKey({
          chainId: input.chainId,
          moduleAddress: input.moduleAddress,
          holder: input.userAddress,
          clientSeriesId: payload.clientSeriesId,
        }),
      } as CommitmentJobPayloadMap[K];
    }
    case "commitment": {
      const payload = input.payload as CommitmentCreationPayload;
      return {
        ...payload,
        creationRequestKey: createCommitmentCreationRequestKey({
          chainId: input.chainId,
          moduleAddress: input.moduleAddress,
          creator: input.userAddress,
          clientCommitmentId: payload.clientCommitmentId,
        }),
      } as CommitmentJobPayloadMap[K];
    }
    case "workLink": {
      const payload = input.payload as WorkLinkJobPayload;
      return {
        ...payload,
        operationKey: createWorkLinkOperationKey({
          chainId: input.chainId,
          moduleAddress: input.moduleAddress,
          caller: input.userAddress,
          clientOperationId: payload.clientOperationId,
        }),
      } as CommitmentJobPayloadMap[K];
    }
    default:
      return { ...input.payload };
  }
}

export function hashSeriesCreationPayload(poolId: bigint, metadataCID: string): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "bytes32" }],
      [poolId, keccak256(stringToBytes(metadataCID))]
    )
  );
}

export function hashWorkLinkPayload(
  commitmentId: bigint,
  workUID: Hex,
  requirementIndex: number
): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "bytes32" }, { type: "uint16" }],
      [commitmentId, workUID, requirementIndex]
    )
  );
}

export function hashCommitmentCreationPayload(payload: CommitmentCreationPayload): Hex {
  const effectiveThreshold = payload.confirmers.length === 0 ? 1 : payload.confirmationThreshold;
  const domainTagsHash = keccak256(encodePacked(["uint8[]"], [payload.domainTags]));
  const requirementsHash = keccak256(
    encodeAbiParameters(
      [{ type: "tuple[]", components: [{ type: "uint256" }, { type: "uint32" }] }],
      [
        payload.requirements.map(
          (requirement) => [requirement.actionUID, requirement.requiredCount] as const
        ),
      ]
    )
  );
  const confirmersHash = keccak256(encodePacked(["address[]"], [payload.confirmers]));
  const considerationHash = keccak256(
    encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { type: "uint8" },
            { type: "address" },
            { type: "address" },
            { type: "uint256" },
          ],
        },
      ],
      [
        [
          payload.consideration.rail,
          payload.consideration.source,
          payload.consideration.token,
          payload.consideration.amount,
        ],
      ]
    )
  );
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint8" },
        { type: "uint8" },
        { type: "uint8" },
        { type: "uint8" },
        { type: "uint8" },
        { type: "address" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "bool" },
        { type: "uint64" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "uint32" },
        { type: "bool" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "bytes32" },
      ],
      [
        payload.poolId,
        payload.cycleId,
        payload.commitmentSeriesId,
        payload.direction,
        payload.commitmentType,
        payload.claimType,
        payload.claimMode,
        payload.contributorPolicy,
        payload.onBehalfOf,
        domainTagsHash,
        requirementsHash,
        keccak256(stringToBytes(payload.unitLabel)),
        payload.targetUnits,
        payload.requiresAssessment,
        payload.dueDate,
        keccak256(stringToBytes(payload.metadataCID)),
        payload.needUID,
        payload.counterCommitmentId,
        confirmersHash,
        effectiveThreshold,
        payload.protocolFallbackEnabled,
        considerationHash,
        payload.declaredUnitValue,
        keccak256(stringToBytes(payload.declaredValueBasis)),
      ]
    )
  );
}
