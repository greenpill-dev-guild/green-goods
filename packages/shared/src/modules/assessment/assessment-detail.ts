import { CynefinPhase, type SmartOutcome } from "../../types/domain";
import { getJsonByHash } from "../data/ipfs/resolve";

/**
 * What an assessment keeps off the chain. Create Assessment uploads the
 * strategy kernel as one JSON file, then a config that names that file and the
 * evidence; the attestation carries only the config's CID.
 */
export interface AssessmentDetail {
  /** Root-cause analysis of the challenge being addressed. */
  diagnosis: string;
  /** SMART outcome targets. An entry with neither a description nor a metric is dropped. */
  smartOutcomes: SmartOutcome[];
  /** Null when the stored value names none of the four Cynefin phases. */
  cynefinPhase: CynefinPhase | null;
  selectedActionUIDs: string[];
  /** UN SDG goal ids, 1 to 17, without repeats. */
  sdgTargets: number[];
  /** Evidence files by CID. The upload keeps no file name or type. */
  evidenceCids: string[];
}

type ReadJson = (
  cid: string,
  options: { signal?: AbortSignal; timeoutMs?: number }
) => Promise<unknown>;

/**
 * How long each of the two files may take. Both are a few hundred bytes. A
 * gateway asked for a file nobody pins does not answer "not found", it hangs,
 * so this is also how long a reader waits to be told the detail is unavailable.
 */
const FILE_READ_TIMEOUT_MS = 8_000;

export interface ReadAssessmentDetailOptions {
  signal?: AbortSignal;
  /** Reads one stored JSON file by CID; the app's gateway chain unless a test supplies its own. */
  readJson?: ReadJson;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
}

function toSmartOutcome(value: unknown): SmartOutcome | null {
  if (!isRecord(value)) return null;
  const description = typeof value.description === "string" ? value.description : "";
  const metric = typeof value.metric === "string" ? value.metric : "";
  if (!description.trim() && !metric.trim()) return null;
  const target = Number(value.target);
  return { description, metric, target: Number.isFinite(target) ? target : 0 };
}

function toCynefinPhase(value: unknown): CynefinPhase | null {
  return typeof value === "number" && value in CynefinPhase ? (value as CynefinPhase) : null;
}

function toSdgTargets(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const goals = value
    .map(Number)
    .filter((goal) => Number.isInteger(goal) && goal >= 1 && goal <= 17);
  return [...new Set(goals)];
}

/**
 * Reads an assessment's stored detail from its config CID. Rejects when either
 * file cannot be read or is not an object: a failed read is not an empty
 * assessment, so the caller has to be able to tell the two apart. Inside a
 * file that was read, a malformed field reads as not recorded.
 */
export async function readAssessmentDetail(
  configCid: string,
  { signal, readJson = getJsonByHash }: ReadAssessmentDetailOptions = {}
): Promise<AssessmentDetail> {
  const config = await readJson(configCid, { signal, timeoutMs: FILE_READ_TIMEOUT_MS });
  if (!isRecord(config)) throw new Error("Assessment config is not an object");

  const metricsCid = typeof config.metricsCid === "string" ? config.metricsCid.trim() : "";
  if (!metricsCid) throw new Error("Assessment config names no metrics file");

  const metrics = await readJson(metricsCid, { signal, timeoutMs: FILE_READ_TIMEOUT_MS });
  if (!isRecord(metrics)) throw new Error("Assessment metrics are not an object");

  return {
    diagnosis: typeof metrics.diagnosis === "string" ? metrics.diagnosis : "",
    smartOutcomes: (Array.isArray(metrics.smartOutcomes) ? metrics.smartOutcomes : [])
      .map(toSmartOutcome)
      .filter((outcome): outcome is SmartOutcome => outcome !== null),
    cynefinPhase: toCynefinPhase(metrics.cynefinPhase),
    selectedActionUIDs: strings(metrics.selectedActionUIDs),
    sdgTargets: toSdgTargets(metrics.sdgTargets),
    evidenceCids: strings(config.evidenceMediaCids),
  };
}
