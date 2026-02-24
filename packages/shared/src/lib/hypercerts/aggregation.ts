import type { Address } from "viem";

import type {
  HypercertAttestation,
  MetricValue,
  OutcomeMetrics,
  PredefinedMetric,
} from "../../types/hypercerts";

export interface ContributorStats {
  address: Address;
  actionCount: number;
  actionValue: number;
  label?: string;
}

function titleizeMetricKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function sumMetricValues(metrics: Record<string, MetricValue> | null | undefined): number {
  if (!metrics) return 0;
  return Object.values(metrics).reduce((sum, metric) => sum + (metric?.value ?? 0), 0);
}

/**
 * Aggregates outcome metrics from multiple attestations into a single OutcomeMetrics object.
 * Sums numeric values for matching metric keys and always includes an attestation count.
 *
 * @param attestations - Array of attestations containing metrics to aggregate
 * @returns Aggregated outcome metrics with predefined sums and attestation count
 */
export function aggregateOutcomeMetrics(attestations: HypercertAttestation[]): OutcomeMetrics {
  const predefined: Record<string, PredefinedMetric> = {};

  for (const attestation of attestations) {
    if (!attestation.metrics) continue;

    for (const [key, metric] of Object.entries(attestation.metrics)) {
      if (!metric || typeof metric.value !== "number" || Number.isNaN(metric.value)) continue;
      if (!predefined[key]) {
        predefined[key] = {
          value: metric.value,
          unit: metric.unit,
          aggregation: "sum",
          label: titleizeMetricKey(key),
        };
      } else {
        predefined[key] = {
          ...predefined[key],
          value: predefined[key].value + metric.value,
        };
      }
    }
  }

  // Always include attestation count for context
  predefined.attestation_count = {
    value: attestations.length,
    unit: "count",
    aggregation: "count",
    label: "Attestation count",
  };

  return {
    predefined,
    custom: {},
  };
}

/**
 * Builds contributor statistics by aggregating attestations per address.
 * Groups attestations by gardener address and sums their action counts and values.
 *
 * @param attestations - Array of attestations to analyze
 * @returns Array of contributor statistics with action counts and values per address
 */
export function buildContributorStats(attestations: HypercertAttestation[]): ContributorStats[] {
  const byAddress = new Map<Address, ContributorStats>();

  for (const attestation of attestations) {
    const address = attestation.gardenerAddress;
    const existing = byAddress.get(address);
    const actionValue = sumMetricValues(attestation.metrics);

    if (existing) {
      existing.actionCount += 1;
      existing.actionValue += actionValue;
    } else {
      byAddress.set(address, {
        address,
        actionCount: 1,
        actionValue,
        label: attestation.gardenerName ?? undefined,
      });
    }
  }

  return Array.from(byAddress.values());
}

export function deriveWorkTimeframe(attestations: HypercertAttestation[]): {
  start: number | null;
  end: number | null;
} {
  if (!attestations.length) return { start: null, end: null };

  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;

  for (const attestation of attestations) {
    const createdAt = attestation.createdAt ?? attestation.approvedAt;
    const approvedAt = attestation.approvedAt ?? attestation.createdAt;

    if (typeof createdAt === "number" && createdAt < start) start = createdAt;
    if (typeof approvedAt === "number" && approvedAt > end) end = approvedAt;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { start: null, end: null };
  }

  return { start, end };
}
