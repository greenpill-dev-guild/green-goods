import { formatHypercertData } from "@hypercerts-org/sdk";

import { logger } from "../../modules/app/logger";
import type {
  AllowlistEntry,
  HypercertAttestation,
  HypercertDraft,
  HypercertMetadata,
} from "../../types/hypercerts";
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

/**
 * The metadata a draft would mint, written by the Hypercerts SDK so that every
 * hypercert carries the same form: each time frame labelled by its UTC days
 * (`2026-03-01 → 2026-08-26`, or `indefinite` for an open end).
 *
 * Null when the SDK refuses the draft. It does that for values the wizard's own
 * fields cannot hold: a time frame end that is not a finite number, or a scope
 * or contributor that is not text.
 */
export function formatHypercertMetadata({
  draft,
  attestations,
  allowlist,
  imageUri,
  gardenName,
}: FormatHypercertMetadataInput): HypercertMetadata | null {
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

  if (!sdkResult.data) {
    logger.warn("[formatHypercertMetadata] The Hypercerts SDK refused the draft", {
      errors: sdkResult.errors,
    });
    return null;
  }

  // The SDK's type comes from its JSON schema, which leaves every claim field
  // optional. formatHypercertData fills each one from the arguments above.
  const sdkMetadata = sdkResult.data as unknown as HypercertMetadata;

  return {
    ...sdkMetadata,
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
