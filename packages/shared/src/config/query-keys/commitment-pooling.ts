import type { Address } from "../../types/domain";

type CommitmentFilters = Readonly<Record<string, unknown>>;

function normalizeAddress(value: Address | string | undefined): string | undefined {
  return value?.toLowerCase();
}

function stableFilters(filters: CommitmentFilters = {}): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(filters)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]): [string, unknown] => [
          key,
          typeof value === "bigint"
            ? value.toString()
            : typeof value === "string" && value.startsWith("0x")
              ? value.toLowerCase()
              : value,
        ])
        .sort(([left], [right]) => left.localeCompare(right))
    )
  );
}

export const commitmentPoolingKeys = {
  all: (chainId: number) => ["greengoods", "commitment-pooling", chainId] as const,
  availability: (chainId: number) =>
    [...commitmentPoolingKeys.all(chainId), "availability"] as const,
  pools: (chainId: number, garden?: Address | string) =>
    [...commitmentPoolingKeys.all(chainId), "pools", normalizeAddress(garden)] as const,
  pool: (chainId: number, poolId: bigint | string | number) =>
    [...commitmentPoolingKeys.all(chainId), "pool", String(poolId)] as const,
  cycles: (chainId: number, poolId: bigint | string | number, filters: CommitmentFilters = {}) =>
    [
      ...commitmentPoolingKeys.all(chainId),
      "cycles",
      String(poolId),
      stableFilters(filters),
    ] as const,
  cycle: (chainId: number, cycleId: bigint | string | number) =>
    [...commitmentPoolingKeys.all(chainId), "cycle", String(cycleId)] as const,
  commitments: (chainId: number, filters: CommitmentFilters = {}) =>
    [...commitmentPoolingKeys.all(chainId), "commitments", stableFilters(filters)] as const,
  commitment: (chainId: number, commitmentId: bigint | string | number) =>
    [...commitmentPoolingKeys.all(chainId), "commitment", String(commitmentId)] as const,
  /**
   * Chain-free on purpose: content at a CID is the same bytes everywhere, so a
   * title resolved on one chain is the same title on another.
   */
  metadata: (cid: string) => ["greengoods", "commitment-pooling", "metadata", cid] as const,
  /** Chain-free for the same reason as `metadata`: a CID is a CID. */
  reason: (cid: string | null) => ["greengoods", "commitment-pooling", "reason", cid] as const,
  evidence: (cid: string) => ["greengoods", "commitment-pooling", "evidence", cid] as const,
  cycleMetadata: (cid: string) =>
    ["greengoods", "commitment-pooling", "cycle-metadata", cid] as const,
  /** Chain-free like the other document keys: the same CID is the same bytes. */
  poolCharter: (cid: string | null) =>
    ["greengoods", "commitment-pooling", "pool-charter", cid] as const,
  workAttributions: (chainId: number, workUID: string | null) =>
    [...commitmentPoolingKeys.all(chainId), "work-attributions", workUID] as const,
  workDecisions: (
    chainId: number,
    commitmentId: bigint | string | number | null,
    workUIDs: readonly string[]
  ) =>
    [
      ...commitmentPoolingKeys.all(chainId),
      "work-decisions",
      commitmentId === null ? null : String(commitmentId),
      workUIDs.join(","),
    ] as const,
  workLinkChoices: (
    chainId: number,
    account: Address | string | undefined,
    workGarden: Address | string | undefined,
    returnGarden: Address | string | undefined,
    actionUID: number | null
  ) =>
    [
      ...commitmentPoolingKeys.all(chainId),
      "work-link-choices",
      normalizeAddress(account),
      normalizeAddress(workGarden),
      normalizeAddress(returnGarden),
      actionUID,
    ] as const,
  linkedWorks: (chainId: number, workUIDs: readonly string[]) =>
    [...commitmentPoolingKeys.all(chainId), "linked-works", workUIDs.join(",")] as const,
  /** The device's own queue, read per account rather than per chain. */
  queueState: (account: string | null | undefined) =>
    ["greengoods", "commitment-pooling", "queue", account?.toLowerCase() ?? null] as const,
  requirements: (chainId: number, commitmentId: bigint | string | number) =>
    [...commitmentPoolingKeys.all(chainId), "requirements", String(commitmentId)] as const,
  contributors: (chainId: number, commitmentId: bigint | string | number) =>
    [...commitmentPoolingKeys.all(chainId), "contributors", String(commitmentId)] as const,
  claims: (chainId: number, commitmentId: bigint | string | number, state?: string) =>
    [...commitmentPoolingKeys.all(chainId), "claims", String(commitmentId), state] as const,
  /** Every claim across a pool, joined through its commitments (the steward's queue). */
  poolClaims: (chainId: number, poolId: bigint | string | number, state?: string) =>
    [...commitmentPoolingKeys.all(chainId), "pool-claims", String(poolId), state] as const,
  /** Ready-for-confirmation rows with their rosters, by pool, garden, or protocol opt-in. */
  fallbackCandidates: (chainId: number, scope: CommitmentFilters = {}) =>
    [...commitmentPoolingKeys.all(chainId), "fallback-candidates", stableFilters(scope)] as const,
  /** The registered protocol pool and root garden, read from the module. */
  protocolPool: (chainId: number) =>
    [...commitmentPoolingKeys.all(chainId), "protocol-pool"] as const,
  seriesList: (chainId: number, filters: CommitmentFilters = {}) =>
    [...commitmentPoolingKeys.all(chainId), "series-list", stableFilters(filters)] as const,
  series: (chainId: number, seriesId: bigint | string | number) =>
    [...commitmentPoolingKeys.all(chainId), "series", String(seriesId)] as const,
  need: (chainId: number, needUID: string) =>
    [...commitmentPoolingKeys.all(chainId), "need", needUID.toLowerCase()] as const,
  exchange: (
    chainId: number,
    poolId: bigint | string | number,
    commitmentIdA: bigint | string | number,
    commitmentIdB: bigint | string | number
  ) =>
    [
      ...commitmentPoolingKeys.all(chainId),
      "exchange",
      String(poolId),
      String(commitmentIdA),
      String(commitmentIdB),
    ] as const,
  hypercertBundle: (chainId: number, hypercertId: bigint | string | number) =>
    [...commitmentPoolingKeys.all(chainId), "hypercert-bundle", String(hypercertId)] as const,
  funding: (chainId: number, commitmentId: bigint | string | number, funder?: Address | string) =>
    [
      ...commitmentPoolingKeys.all(chainId),
      "funding",
      String(commitmentId),
      normalizeAddress(funder),
    ] as const,
  settlementConfiguration: (chainId: number) =>
    [...commitmentPoolingKeys.all(chainId), "settlement-configuration"] as const,
  settlementAccount: (chainId: number, garden: Address | string) =>
    [
      ...commitmentPoolingKeys.all(chainId),
      "settlement-account",
      normalizeAddress(garden),
    ] as const,
  poolFunding: (chainId: number, garden: Address | string) =>
    [...commitmentPoolingKeys.all(chainId), "pool-funding", normalizeAddress(garden)] as const,
  settlementSubject: (chainId: number, isBatch: boolean, subjectId: bigint | string | number) =>
    [
      ...commitmentPoolingKeys.all(chainId),
      "settlement-subject",
      isBatch ? "batch" : "disbursement",
      String(subjectId),
    ] as const,
  payoutPlan: (chainId: number, payoutPlanId: bigint | string | number) =>
    [...commitmentPoolingKeys.all(chainId), "payout-plan", String(payoutPlanId)] as const,
  memberHistory: (
    chainId: number,
    poolId: bigint | string | number,
    account: Address | string,
    viewer?: Address | string
  ) =>
    [
      ...commitmentPoolingKeys.all(chainId),
      "member-history",
      String(poolId),
      normalizeAddress(account),
      normalizeAddress(viewer),
    ] as const,
  participationSummary: (chainId: number, poolId: bigint | string | number) =>
    [...commitmentPoolingKeys.all(chainId), "participation-summary", String(poolId)] as const,
  activity: (chainId: number, filters: CommitmentFilters = {}) =>
    [...commitmentPoolingKeys.all(chainId), "activity", stableFilters(filters)] as const,
} as const;
