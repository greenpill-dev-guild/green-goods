import type { GardenAssessmentAttestation } from "@/modules/eas";

export interface AssessmentParsedData {
  carbonTonStock?: number;
  carbonTonPotential?: number;
  soilMoisturePercentage?: number;
  gardenSquareMeters?: number;
  biome?: string;
  tags?: string[];
  issues?: string[];
}

export interface GardenAssessmentWithParsed extends GardenAssessmentAttestation {
  parsed: AssessmentParsedData;
}

function extractNumeric(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value && typeof value === "object") {
    if ("value" in (value as Record<string, unknown>)) {
      return extractNumeric((value as Record<string, unknown>).value);
    }

    if ("hex" in (value as Record<string, unknown>)) {
      try {
        const asHex = (value as Record<string, unknown>).hex;
        if (typeof asHex === "string") {
          return Number(BigInt(asHex));
        }
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

function extractString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    return extractString((value as Record<string, unknown>).value);
  }

  return undefined;
}

function extractStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.map((item) => extractString(item) ?? String(item)).filter(Boolean) as string[];
  }

  if (value && typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    return extractStringArray((value as Record<string, unknown>).value);
  }

  return undefined;
}

function parseAssessmentObject(raw: unknown): AssessmentParsedData {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const record = raw as Record<string, unknown>;

  return {
    carbonTonStock: extractNumeric(record.carbonTonStock),
    carbonTonPotential: extractNumeric(record.carbonTonPotential),
    soilMoisturePercentage: extractNumeric(record.soilMoisturePercentage),
    gardenSquareMeters: extractNumeric(record.gardenSquareMeters),
    biome: extractString(record.biome),
    tags: extractStringArray(record.tags),
    issues: extractStringArray(record.issues),
  };
}

function parseAssessmentTuple(raw: unknown): AssessmentParsedData {
  if (!Array.isArray(raw)) {
    return {};
  }

  const result: AssessmentParsedData = {};

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const name = extractString(record.name) ?? String(record.name ?? "");
    if (!name) continue;

    const value = "value" in record ? (record.value as unknown) : undefined;

    switch (name) {
      case "carbonTonStock":
        result.carbonTonStock = extractNumeric(value);
        break;
      case "carbonTonPotential":
        result.carbonTonPotential = extractNumeric(value);
        break;
      case "soilMoisturePercentage":
        result.soilMoisturePercentage = extractNumeric(value);
        break;
      case "gardenSquareMeters":
        result.gardenSquareMeters = extractNumeric(value);
        break;
      case "biome":
        result.biome = extractString(value);
        break;
      case "tags":
        result.tags = extractStringArray(value);
        break;
      case "issues":
        result.issues = extractStringArray(value);
        break;
      default:
        break;
    }
  }

  return result;
}

export function parseAssessment(attestation: GardenAssessmentAttestation): GardenAssessmentWithParsed {
  let parsed: AssessmentParsedData = {};

  if (attestation.decodedDataJson) {
    try {
      const raw = JSON.parse(attestation.decodedDataJson);
      parsed = Array.isArray(raw) ? parseAssessmentTuple(raw) : parseAssessmentObject(raw);
    } catch (error) {
      console.warn("Failed to parse garden assessment attestation", error);
      parsed = {};
    }
  }

  return {
    ...attestation,
    parsed,
  };
}
