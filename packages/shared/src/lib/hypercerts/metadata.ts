import { formatHypercertData } from "@hypercerts-org/sdk";

import type {
  AllowlistEntry,
  HypercertAttestation,
  HypercertDraft,
  HypercertMetadata,
  ScopeDefinition,
  TimeframeDefinition,
} from "../../types/hypercerts";
import { formatDate } from "../../utils/time";
import { DEFAULT_PROTOCOL_VERSION } from "./constants";
import {
  aggregateOutcomeMetrics,
  buildContributorStats,
  deriveWorkTimeframe,
} from "./aggregation";

interface FormatHypercertMetadataInput {
  draft: HypercertDraft;
  attestations: HypercertAttestation[];
  allowlist?: AllowlistEntry[];
  imageUri?: string;
  gardenName?: string;
}

function createScope(
  name: string,
  values: string[],
  fallback: string[],
  displayValue?: string
): ScopeDefinition {
  const value = values.length ? values : fallback;
  return {
    name,
    value,
    display_value: displayValue,
  };
}

function createTimeframe(
  name: string,
  start: number | null,
  end: number | null,
  allowIndefinite = false
): TimeframeDefinition {
  const safeStart = start ?? 0;
  const safeEnd = end ?? (allowIndefinite ? 0 : safeStart);

  const displayStart = safeStart ? formatDate(safeStart * 1000, { dateStyle: "medium" }) : "";
  const displayEnd =
    safeEnd === 0 && allowIndefinite
      ? "Indefinite"
      : safeEnd
        ? formatDate(safeEnd * 1000, { dateStyle: "medium" })
        : "";

  const displayValue =
    displayStart && displayEnd ? `${displayStart} – ${displayEnd}` : displayStart || displayEnd;

  return {
    name,
    value: [safeStart, safeEnd],
    display_value: displayValue || name,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildFallbackImage(title: string, gardenName?: string): string {
  const safeTitle = escapeXml(title.trim() || "Hypercert");
  const safeGarden = gardenName?.trim() ? escapeXml(gardenName.trim()) : undefined;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="1200" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e5f8e5" />
      <stop offset="100%" stop-color="#cde6ff" />
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)" />
  <rect x="120" y="120" width="960" height="960" rx="48" fill="#ffffff" fill-opacity="0.92" />
  <text x="600" y="520" text-anchor="middle" font-family="'Inter', sans-serif" font-size="56" fill="#1f2937">
    ${safeTitle}
  </text>
  ${
    safeGarden
      ? `<text x="600" y="600" text-anchor="middle" font-family="'Inter', sans-serif" font-size="32" fill="#4b5563">${safeGarden}</text>`
      : ""
  }
  <text x="600" y="760" text-anchor="middle" font-family="'Inter', sans-serif" font-size="24" fill="#9ca3af">Green Goods Hypercert</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function formatHypercertMetadata({
  draft,
  attestations,
  allowlist,
  imageUri,
  gardenName,
}: FormatHypercertMetadataInput): HypercertMetadata {
  const attestationRefs = attestations.map((attestation) => ({
    uid: attestation.id as `0x${string}`,
    title: attestation.title,
    domain: attestation.domain,
  }));

  const contributorAddresses = allowlist?.length
    ? allowlist.map((entry) => entry.address)
    : attestations.map((attestation) => attestation.gardenerAddress);

  const contributors = unique(contributorAddresses);
  const workScopesFromAttestations = unique(
    attestations.flatMap((attestation) => attestation.workScope ?? [])
  );
  const domainFromAttestations = attestations.find((attestation) => attestation.domain)?.domain;

  const derivedTimeframe = deriveWorkTimeframe(attestations);

  const workTimeframeStart = draft.workTimeframeStart || derivedTimeframe.start || 0;
  const workTimeframeEnd =
    draft.workTimeframeEnd || derivedTimeframe.end || draft.workTimeframeStart || workTimeframeStart;
  const impactTimeframeStart =
    draft.impactTimeframeStart || draft.workTimeframeStart || derivedTimeframe.start || 0;
  const impactTimeframeEnd = draft.impactTimeframeEnd ?? 0;

  const image = imageUri || buildFallbackImage(draft.title, gardenName);

  const sdkResult = formatHypercertData({
    name: draft.title,
    description: draft.description,
    external_url: draft.externalUrl?.trim() || undefined,
    image,
    version: DEFAULT_PROTOCOL_VERSION,
    impactScope: draft.impactScopes.length ? draft.impactScopes : ["all"],
    excludedImpactScope: [],
    workScope: draft.workScopes.length ? draft.workScopes : workScopesFromAttestations,
    excludedWorkScope: [],
    workTimeframeStart,
    workTimeframeEnd,
    impactTimeframeStart,
    impactTimeframeEnd,
    contributors,
    rights: ["Public Display"],
    excludedRights: [],
  });

  const fallbackMetadata: HypercertMetadata = {
    name: draft.title,
    description: draft.description,
    image,
    external_url: draft.externalUrl?.trim() || undefined,
    hypercert: {
      work_scope: createScope("Work scope", draft.workScopes, workScopesFromAttestations),
      impact_scope: createScope("Impact scope", draft.impactScopes, ["all"]),
      work_timeframe: createTimeframe("Work timeframe", workTimeframeStart, workTimeframeEnd),
      impact_timeframe: createTimeframe(
        "Impact timeframe",
        impactTimeframeStart,
        impactTimeframeEnd || null,
        true
      ),
      contributors: createScope("Contributors", contributors, contributors),
      rights: createScope("Rights", ["Public Display"], ["Public Display"]),
    },
  };

  const baseMetadata = (sdkResult.data ?? fallbackMetadata) as HypercertMetadata;

  return {
    ...baseMetadata,
    hidden_properties: {
      gardenId: draft.gardenId,
      attestationRefs,
      sdgs: draft.sdgs,
      capitals: draft.capitals,
      outcomes: Object.keys(draft.outcomes.predefined).length
        ? draft.outcomes
        : aggregateOutcomeMetrics(attestations),
      domain: domainFromAttestations ?? "mutual_credit",
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
    },
  };
}

export function buildContributorWeights(attestations: HypercertAttestation[]) {
  return buildContributorStats(attestations).map((contributor) => ({
    address: contributor.address,
    label: contributor.label,
    actionCount: contributor.actionCount,
    actionValue: contributor.actionValue,
  }));
}
