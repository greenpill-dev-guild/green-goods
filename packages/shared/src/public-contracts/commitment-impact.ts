export interface PublicCommitmentImpactUnavailableSources {
  commitmentPools: boolean;
  confirmedSettlement: boolean;
  fundingValuation: boolean;
}

export interface PublicCommitmentImpactRecord {
  commitmentsMade: bigint | null;
  commitmentsFulfilled: bigint | null;
  confirmedDisbursementTotal: bigint | null;
  confirmedDisbursementUsdCents: bigint | null;
  partialData: boolean;
  unavailableSources: PublicCommitmentImpactUnavailableSources;
}

export interface PublicCommitmentImpactResponseV1 {
  version: 1;
  chainId: number;
  commitmentsMade: string | null;
  commitmentsFulfilled: string | null;
  confirmedDisbursementTotal: string | null;
  confirmedDisbursementUsdCents: string | null;
  partialData: boolean;
  unavailableSources: PublicCommitmentImpactUnavailableSources;
}

// These source chains index commitments and their Celo settlement executions.
export function isPublicCommitmentImpactChainSupported(chainId: number): boolean {
  return chainId === 42161 || chainId === 11155111;
}

function count(value: unknown): bigint | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value) || value.length > 78) {
    throw new Error("Invalid public commitment impact count");
  }
  return BigInt(value);
}

/** Validate the wire response before treating a figure as zero or available. */
export function parsePublicCommitmentImpactResponse(
  value: unknown,
  chainId: number
): PublicCommitmentImpactRecord {
  if (!value || typeof value !== "object") throw new Error("Invalid commitment impact response");
  const response = value as Partial<PublicCommitmentImpactResponseV1>;
  if (response.version !== 1 || response.chainId !== chainId) {
    throw new Error("Unexpected commitment impact version or chain");
  }
  const sources = response.unavailableSources;
  if (
    !sources ||
    typeof sources.commitmentPools !== "boolean" ||
    typeof sources.confirmedSettlement !== "boolean" ||
    typeof sources.fundingValuation !== "boolean"
  ) {
    throw new Error("Invalid commitment impact availability");
  }
  const commitmentsMade = count(response.commitmentsMade);
  const commitmentsFulfilled = count(response.commitmentsFulfilled);
  const confirmedDisbursementTotal = count(response.confirmedDisbursementTotal);
  const confirmedDisbursementUsdCents = count(response.confirmedDisbursementUsdCents);
  const partialData = Object.values(sources).some(Boolean);
  if (
    response.partialData !== partialData ||
    sources.commitmentPools !== (commitmentsMade === null) ||
    sources.commitmentPools !== (commitmentsFulfilled === null) ||
    sources.confirmedSettlement !== (confirmedDisbursementTotal === null) ||
    sources.fundingValuation !== (confirmedDisbursementUsdCents === null) ||
    (sources.confirmedSettlement && !sources.fundingValuation) ||
    (confirmedDisbursementTotal === 0n && confirmedDisbursementUsdCents !== 0n)
  ) {
    throw new Error("Inconsistent commitment impact availability");
  }
  return {
    commitmentsMade,
    commitmentsFulfilled,
    confirmedDisbursementTotal,
    confirmedDisbursementUsdCents,
    partialData,
    unavailableSources: { ...sources },
  };
}

export function serializePublicCommitmentImpact(
  record: PublicCommitmentImpactRecord,
  chainId: number
): PublicCommitmentImpactResponseV1 {
  return {
    version: 1,
    chainId,
    commitmentsMade: record.commitmentsMade?.toString() ?? null,
    commitmentsFulfilled: record.commitmentsFulfilled?.toString() ?? null,
    confirmedDisbursementTotal: record.confirmedDisbursementTotal?.toString() ?? null,
    confirmedDisbursementUsdCents: record.confirmedDisbursementUsdCents?.toString() ?? null,
    partialData: record.partialData,
    unavailableSources: { ...record.unavailableSources },
  };
}
