import type { GardenAssessment } from "../../types/domain";
import {
  ACTION_DOMAINS,
  type ActionDomain,
  type ActionType,
  type HypercertRecord,
  type HypercertStatus,
  type MetricValue,
} from "../../types/hypercerts";
import { logger } from "../app/logger";
import { resolveIPFSUrl } from "./ipfs";
import { domainToActionDomain } from "./hypercerts-filters";

// =============================================================================
// Helpers
// =============================================================================

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length > 0 ? items : undefined;
}

export function normalizeHypercertStatus(status?: string | null): HypercertStatus {
  switch ((status || "").toLowerCase()) {
    case "active":
      return "active";
    case "claimed":
      return "claimed";
    case "sold":
      return "sold";
    default:
      return "unknown";
  }
}

// =============================================================================
// Work Metadata Extraction
// =============================================================================

export function extractWorkMetadata(metadata: string | undefined): {
  domain?: ActionDomain;
  actionType?: ActionType;
  workScope?: string[];
  metrics?: Record<string, MetricValue>;
} {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata) as unknown;
    if (!isRecord(parsed)) return {};

    const domainRaw = parsed.domain ?? parsed.actionDomain;
    const domain = ACTION_DOMAINS.includes(domainRaw as ActionDomain)
      ? (domainRaw as ActionDomain)
      : undefined;

    const actionType =
      typeof parsed.actionType === "string" ? (parsed.actionType as ActionType) : undefined;

    const scopeCandidate = parsed.workScope ?? parsed.workScopes ?? parsed.work_scope;
    const workScope =
      Array.isArray(scopeCandidate) && scopeCandidate.every((item) => typeof item === "string")
        ? (scopeCandidate as string[])
        : typeof scopeCandidate === "string"
          ? [scopeCandidate]
          : undefined;

    const metrics = isRecord(parsed.metrics)
      ? (parsed.metrics as Record<string, MetricValue>)
      : undefined;

    return { domain, actionType, workScope, metrics };
  } catch {
    return {};
  }
}

// =============================================================================
// IPFS Metadata
// =============================================================================

export function parseMetadataPayload(payload: unknown): Partial<HypercertRecord> {
  if (!isRecord(payload)) return {};

  const title = getString(payload.name);
  const description = getString(payload.description);
  const image = getString(payload.image);

  let workScopes: string[] | undefined;
  const hypercertMetadata = isRecord(payload.hypercert) ? payload.hypercert : undefined;
  if (hypercertMetadata) {
    const workScope = isRecord(hypercertMetadata.work_scope)
      ? hypercertMetadata.work_scope
      : undefined;
    if (workScope) {
      workScopes = getStringArray(workScope.value);
    }
  }

  return {
    title,
    description,
    imageUri: image ? resolveIPFSUrl(image) : undefined,
    workScopes,
  };
}

export async function getHypercertMetadataFromIpfs(
  metadataUri?: string
): Promise<Partial<HypercertRecord>> {
  if (!metadataUri) return {};

  try {
    const response = await fetch(resolveIPFSUrl(metadataUri));
    if (!response.ok) {
      return {};
    }
    const payload = (await response.json()) as unknown;
    return parseMetadataPayload(payload);
  } catch (error) {
    logger.debug("[getHypercertMetadataFromIpfs] Metadata fetch failed", {
      metadataUri,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

// =============================================================================
// Assessment Metadata Prefill
// =============================================================================

/**
 * Metadata fields that can be prefilled from an assessment.
 * Compatible with HypercertWizardStore.updateMetadata().
 */
export interface AssessmentMetadataPrefill {
  title: string;
  description: string;
  workScopes: string[];
  impactScopes: string[];
  workTimeframeStart: number;
  workTimeframeEnd: number;
  sdgs: number[];
  outcomes: import("../../types/hypercerts").OutcomeMetrics;
}

/**
 * Derives hypercert metadata fields from a GardenAssessment.
 *
 * Mapping follows the WHAT / HOW MUCH framework:
 * - WHAT (scope tags): domain name + SDG labels -> workScopes;
 *   SMART outcome descriptions -> impactScopes
 * - HOW MUCH (metrics): SMART outcomes -> outcomes.predefined (with aggregation)
 * - Timeframe: assessment reportingPeriod -> workTimeframeStart/End
 * - SDGs: direct passthrough from assessment sdgTargets
 *
 * @param assessment - The garden assessment to derive metadata from
 * @param getSDGLabel - Optional SDG label lookup function (for tree-shaking in non-UI contexts)
 */
export function prefillMetadataFromAssessment(
  assessment: GardenAssessment,
  getSDGLabel?: (id: number) => string | undefined
): AssessmentMetadataPrefill {
  const actionDomain = domainToActionDomain(assessment.domain);

  // WHAT -- work scopes from domain + SDG labels
  const workScopes: string[] = [];
  if (actionDomain) {
    workScopes.push(actionDomain);
  }
  if (getSDGLabel) {
    for (const sdgId of assessment.sdgTargets) {
      const label = getSDGLabel(sdgId);
      if (label) workScopes.push(label);
    }
  }

  // WHAT -- impact scopes from SMART outcome descriptions
  const impactScopes: string[] = assessment.smartOutcomes.map((o) => o.description).filter(Boolean);

  // HOW MUCH -- outcome metrics from SMART outcomes (predefined with aggregation)
  const predefined: Record<string, import("../../types/hypercerts").PredefinedMetric> = {};
  for (const outcome of assessment.smartOutcomes) {
    if (outcome.metric) {
      predefined[outcome.metric] = {
        value: outcome.target,
        unit: outcome.metric,
        aggregation: "sum",
        label: outcome.description || outcome.metric,
      };
    }
  }

  return {
    title: assessment.title,
    description: assessment.diagnosis,
    workScopes,
    impactScopes,
    workTimeframeStart: assessment.reportingPeriod.start,
    workTimeframeEnd: assessment.reportingPeriod.end,
    sdgs: [...assessment.sdgTargets],
    outcomes: {
      predefined,
      custom: {},
    },
  };
}
