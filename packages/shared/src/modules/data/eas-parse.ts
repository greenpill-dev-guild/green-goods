import { getAddress, isAddress } from "viem";
import type { Address, WorkApproval } from "../../types/domain";
import type {
  EASAttestationRaw,
  EASDecodedField,
  EASGardenAssessment,
  EASWork,
  EASWorkApproval,
} from "../../types/eas-responses";
import { logger } from "../app/logger";
import { resolveIPFSUrl } from "./ipfs/resolve";

function isDecodedField(field: unknown): field is EASDecodedField {
  if (!field || typeof field !== "object" || Array.isArray(field)) return false;

  const candidate = field as Record<string, unknown>;
  if (typeof candidate.name !== "string") return false;
  if (!candidate.value || typeof candidate.value !== "object" || Array.isArray(candidate.value)) {
    return false;
  }

  const value = candidate.value as Record<string, unknown>;
  return "value" in value && (value.hex === undefined || typeof value.hex === "string");
}

function validateDecodedDataJson(decodedDataJson: string): void {
  let decoded: unknown;
  try {
    decoded = JSON.parse(decodedDataJson);
  } catch {
    throw new TypeError("EAS attestation has invalid decoded data JSON");
  }

  if (!Array.isArray(decoded) || !decoded.every(isDecodedField)) {
    throw new TypeError("EAS attestation has an invalid decoded data payload");
  }
}

function parseEasCreationTime(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new TypeError("EAS attestation has an invalid creation time");
  }
  if (typeof value === "string" && value.trim() === "") {
    throw new TypeError("EAS attestation has an invalid creation time");
  }

  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError("EAS attestation has an invalid creation time");
  }
  return timestamp;
}

/** Validate and normalize an untrusted EAS GraphQL attestation record. */
export function parseEasAttestationRecord(attestation: unknown): EASAttestationRaw {
  if (!attestation || typeof attestation !== "object" || Array.isArray(attestation)) {
    throw new TypeError("EAS attestation must be an object");
  }

  const candidate = attestation as Record<string, unknown>;
  if (typeof candidate.id !== "string" || typeof candidate.decodedDataJson !== "string") {
    throw new TypeError("EAS attestation is missing its id or decoded data");
  }
  if (typeof candidate.attester !== "string" || !isAddress(candidate.attester)) {
    throw new TypeError("EAS attestation has an invalid attester address");
  }
  if (typeof candidate.recipient !== "string" || !isAddress(candidate.recipient)) {
    throw new TypeError("EAS attestation has an invalid recipient address");
  }
  const timeCreated = parseEasCreationTime(candidate.timeCreated);
  validateDecodedDataJson(candidate.decodedDataJson);

  return {
    id: candidate.id,
    attester: getAddress(candidate.attester),
    recipient: getAddress(candidate.recipient),
    timeCreated,
    decodedDataJson: candidate.decodedDataJson,
    ...(typeof candidate.revoked === "boolean" ? { revoked: candidate.revoked } : {}),
    ...(typeof candidate.schemaId === "string" ? { schemaId: candidate.schemaId } : {}),
  };
}

type NumberConvertibleValue =
  | number
  | bigint
  | string
  | { hex: string }
  | { value: NumberConvertibleValue }
  | null
  | undefined;

function toNumberFromField(value: NumberConvertibleValue): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    if (value.startsWith("0x")) {
      try {
        return Number(BigInt(value));
      } catch (error) {
        logger.debug("Failed to parse hex string to BigInt", { error, value });
        return null;
      }
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if ("hex" in value && typeof value.hex === "string") {
    try {
      return Number(BigInt(value.hex));
    } catch (error) {
      logger.debug("Failed to parse hex object to BigInt", { error, hex: value.hex });
      return null;
    }
  }
  return "value" in value ? toNumberFromField(value.value) : null;
}

export function parseDataToGardenAssessment(
  gardenAssessmentUID: string,
  attestation: { attester: Address; recipient: Address; time: number },
  decodedDataJson: string | EASDecodedField[]
): EASGardenAssessment {
  const fields: EASDecodedField[] = Array.isArray(decodedDataJson)
    ? decodedDataJson
    : JSON.parse(decodedDataJson ?? "[]");
  const readValue = (name: string): unknown =>
    fields.find((field) => field.name === name)?.value?.value;
  const readString = (name: string): string => (readValue(name) as string) ?? "";

  return {
    id: gardenAssessmentUID,
    authorAddress: attestation.attester,
    gardenAddress: attestation.recipient,
    title: readString("title"),
    description: readString("description"),
    assessmentConfigCID: readString("assessmentConfigCID"),
    domain: toNumberFromField(readValue("domain") as NumberConvertibleValue) ?? 0,
    startDate: toNumberFromField(readValue("startDate") as NumberConvertibleValue),
    endDate: toNumberFromField(readValue("endDate") as NumberConvertibleValue),
    location: readString("location"),
    createdAt: attestation.time,
  };
}

export function parseDataToWork(
  workUID: string,
  attestation: { attester: Address; recipient: Address; time: number },
  decodedDataJson: string
): EASWork {
  const data: EASDecodedField[] = JSON.parse(decodedDataJson);
  const field = (name: string) => data.find((item) => item.name === name);
  const mediaCIDs = (field("media")?.value?.value as string[]) || [];
  const actionUIDData = field("actionUID");
  const actionUID =
    toNumberFromField(
      (actionUIDData?.value?.hex ?? actionUIDData?.value?.value) as NumberConvertibleValue
    ) ?? 0;

  return {
    id: workUID,
    gardenerAddress: attestation.attester,
    gardenAddress: attestation.recipient,
    actionUID,
    title: (field("title")?.value?.value as string) || "Untitled Work",
    feedback: (field("feedback")?.value?.value as string) || "",
    metadata: (field("metadata")?.value?.value as string) || "",
    media: mediaCIDs.map((cid) => resolveIPFSUrl(cid)),
    createdAt: attestation.time,
  };
}

export function parseDataToWorkApproval(
  workApprovalUID: string,
  attestation: { attester: Address; recipient: Address; time: number },
  decodedDataJson: string
): EASWorkApproval {
  const data: EASDecodedField[] = JSON.parse(decodedDataJson);
  const field = (name: string) => data.find((item) => item.name === name);
  const rawApproved = field("approved")?.value?.value;
  const approved =
    typeof rawApproved === "boolean"
      ? rawApproved
      : typeof rawApproved === "string"
        ? rawApproved.toLowerCase() === "true" || rawApproved === "1"
        : typeof rawApproved === "number" && rawApproved !== 0;

  return {
    id: workApprovalUID,
    stewardAddress: attestation.attester,
    gardenerAddress: attestation.recipient,
    actionUID: toNumberFromField(field("actionUID")?.value?.value as NumberConvertibleValue) ?? 0,
    workUID: (field("workUID")?.value?.value as string) || "",
    approved,
    feedback: (field("feedback")?.value?.value as string) || "",
    confidence: toNumberFromField(field("confidence")?.value?.value as NumberConvertibleValue) ?? 0,
    verificationMethod:
      toNumberFromField(field("verificationMethod")?.value?.value as NumberConvertibleValue) ?? 0,
    reviewNotesCID: (field("reviewNotesCID")?.value?.value as string) || "",
    createdAt: attestation.time,
  };
}

interface WorkApprovalAttestationRecord {
  id: string;
  attester: Address;
  recipient: Address;
  timeCreated: number | string;
  decodedDataJson: string;
}

export function parseWorkApprovalAttestation(
  attestation: WorkApprovalAttestationRecord
): WorkApproval {
  const parsed = parseDataToWorkApproval(
    attestation.id,
    {
      attester: attestation.attester,
      recipient: attestation.recipient,
      time: parseEasCreationTime(attestation.timeCreated),
    },
    attestation.decodedDataJson
  );
  return {
    id: parsed.id,
    stewardAddress: parsed.stewardAddress,
    gardenerAddress: parsed.gardenerAddress,
    actionUID: parsed.actionUID,
    workUID: parsed.workUID,
    approved: parsed.approved,
    feedback: parsed.feedback,
    confidence: parsed.confidence,
    verificationMethod: parsed.verificationMethod,
    createdAt: parsed.createdAt * 1000,
  };
}
