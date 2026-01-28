import type { Address } from "viem";
import type { AllowlistEntry } from "../../types/hypercerts";
import { TOTAL_UNITS } from "./constants";

export type DistributionMode = "equal" | "proportional" | "count" | "value" | "custom";

export interface ContributorWeight {
  address: Address;
  label?: string;
  actionCount?: number;
  actionValue?: number;
}

export function sumUnits(entries: AllowlistEntry[]): bigint {
  return entries.reduce((sum, entry) => sum + entry.units, 0n);
}

function distributeRemainder(
  allocations: AllowlistEntry[],
  remainder: bigint,
  weights: bigint[]
) {
  if (remainder <= 0n) return;

  // Distribute remainder to highest-weight contributors first
  // Use comparison to avoid BigInt-to-Number precision loss
  const indices = allocations
    .map((_, index) => index)
    .sort((a, b) => (weights[b] > weights[a] ? 1 : weights[b] < weights[a] ? -1 : 0));

  let remaining = remainder;
  let cursor = 0;
  while (remaining > 0n && indices.length > 0) {
    const idx = indices[cursor % indices.length];
    allocations[idx] = {
      ...allocations[idx],
      units: allocations[idx].units + 1n,
    };
    remaining -= 1n;
    cursor += 1;
  }
}

function buildEqualDistribution(contributors: ContributorWeight[]): AllowlistEntry[] {
  if (contributors.length === 0) {
    throw new Error("Cannot distribute units without contributors");
  }

  const base = TOTAL_UNITS / BigInt(contributors.length);
  const remainder = TOTAL_UNITS - base * BigInt(contributors.length);

  const allocations: AllowlistEntry[] = contributors.map((contributor) => ({
    address: contributor.address,
    units: base,
    label: contributor.label,
  }));

  distributeRemainder(
    allocations,
    remainder,
    contributors.map(() => 1n)
  );

  return allocations;
}

function buildProportionalDistribution(
  contributors: ContributorWeight[],
  weights: bigint[]
): AllowlistEntry[] {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0n);

  if (totalWeight === 0n) {
    return buildEqualDistribution(contributors);
  }

  const allocations: AllowlistEntry[] = contributors.map((contributor, index) => ({
    address: contributor.address,
    units: (TOTAL_UNITS * weights[index]) / totalWeight,
    label: contributor.label,
  }));

  const remainder = TOTAL_UNITS - sumUnits(allocations);
  distributeRemainder(allocations, remainder, weights);

  return allocations;
}

export function calculateDistribution(
  contributors: ContributorWeight[],
  mode: DistributionMode,
  customEntries?: AllowlistEntry[]
): AllowlistEntry[] {
  if (mode === "custom") {
    if (!customEntries || customEntries.length === 0) {
      throw new Error("Custom distribution requires entries");
    }

    const total = sumUnits(customEntries);
    if (total !== TOTAL_UNITS) {
      throw new Error(`Distribution must total ${TOTAL_UNITS.toString()} units`);
    }

    return customEntries;
  }

  if (mode === "equal") {
    return buildEqualDistribution(contributors);
  }

  const weights =
    mode === "value"
      ? contributors.map((c) => BigInt(Math.max(0, c.actionValue ?? 0)))
      : contributors.map((c) => BigInt(Math.max(0, c.actionCount ?? 0)));

  return buildProportionalDistribution(contributors, weights);
}

export function validateAllowlist(entries: AllowlistEntry[]): { valid: boolean; error?: string } {
  if (entries.length === 0) {
    return { valid: false, error: "Allowlist is empty" };
  }

  const total = sumUnits(entries);
  if (total !== TOTAL_UNITS) {
    return { valid: false, error: `Total units must equal ${TOTAL_UNITS.toString()}` };
  }

  const invalid = entries.find((entry) => entry.units <= 0n);
  if (invalid) {
    return { valid: false, error: "Allowlist contains non-positive units" };
  }

  return { valid: true };
}
