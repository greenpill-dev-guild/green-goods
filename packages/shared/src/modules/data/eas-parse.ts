import type { WorkApproval } from "../../types/domain";
import type {
  EASDecodedField,
  EASGardenAssessment,
  EASWork,
  EASWorkApproval,
} from "../../types/eas-responses";
import { logger } from "../app/logger";
import { resolveIPFSUrl } from "./ipfs/resolve";

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
  attestation: { attester: string; recipient: string; time: number },
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
  attestation: { attester: string; recipient: string; time: number },
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
  attestation: { attester: string; recipient: string; time: number },
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
    operatorAddress: attestation.attester,
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
  attester: string;
  recipient: string;
  timeCreated: number;
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
      time: attestation.timeCreated,
    },
    attestation.decodedDataJson
  );
  return {
    id: parsed.id,
    operatorAddress: parsed.operatorAddress,
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
