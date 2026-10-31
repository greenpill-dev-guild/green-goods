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
  /** How far the chain's clock runs from this device's, which due dates are read on. */
  chainClock: (chainId: number) => [...commitmentPoolingKeys.all(chainId), "chain-clock"] as const,
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
  serviceAccess: (
    chainId: number,
    module: Address,
    commitmentId: bigint,
    buyer: Address,
    rehearsal: boolean
  ) =>
    [
      ...commitmentPoolingKeys.all(chainId),
      "service-access",
      module.toLowerCase(),
      String(commitmentId),
      buyer.toLowerCase(),
      rehearsal ? "local-rehearsal" : "indexed",
    ] as const,
  /** Every account's voucher wallet on a source chain, so a service act refreshes them all. */
  voucherWallets: (chainId: number) =>
    [...commitmentPoolingKeys.all(chainId), "voucher-wallet"] as const,
  voucherWallet: (chainId: number, module: Address, account: Address, rehearsal: boolean) =>
    [
      ...commitmentPoolingKeys.voucherWallets(chainId),
      module.toLowerCase(),
      account.toLowerCase(),
      rehearsal ? "local-rehearsal" : "onchain",
    ] as const,
  /**
   * Keyed by the issuer's own chain, where a collective's threshold is read from its Safe, and by
   * its authority: the same account as a member approves from itself, with no Safe read.
   */
  issuerApproval: (
    chainId: number,
    issuer: Address,
    kind: "collective" | "individual",
    rehearsal: boolean
  ) =>
    [
      ...commitmentPoolingKeys.all(chainId),
      "issuer-approval",
      issuer.toLowerCase(),
      kind,
      rehearsal ? "local-rehearsal" : "onchain",
    ] as const,
  /** An issuer Safe's signature rule on the voucher network; the DEV rehearsal keeps its own. */
  issuerSafeThreshold: (chainId: number, safe?: Address | string, rehearsal = false) =>
    rehearsal
      ? ([
          ...commitmentPoolingKeys.all(chainId),
          "issuer-safe-threshold",
          normalizeAddress(safe),
          "local-rehearsal",
        ] as const)
      : ([
          ...commitmentPoolingKeys.all(chainId),
          "issuer-safe-threshold",
          normalizeAddress(safe),
        ] as const),
  /** A garden pool's voucher bookings, its voucher issuer and that issuer's reserve. */
  voucherConsole: (chainId: number, garden: Address | string) =>
    [...commitmentPoolingKeys.all(chainId), "voucher-console", normalizeAddress(garden)] as const,
  issuerOperations: (account?: Address | null, routeId?: string, assetId?: string) =>
    [
      ...commitmentPoolingKeys.all(100),
      "issuer-operations",
      normalizeAddress(account ?? undefined),
      routeId,
      assetId,
    ] as const,
  /** Member issuer drafts, every member's for the stewards' card or one member's own. */
  issuerDrafts: (member?: Address | null) =>
    member
      ? ([...commitmentPoolingKeys.all(100), "issuer-drafts", normalizeAddress(member)] as const)
      : ([...commitmentPoolingKeys.all(100), "issuer-drafts"] as const),
  /** Each issuer token's admission and holding limit in the shared pool. */
  issuerListings: (routeIds: readonly string[]) =>
    [...commitmentPoolingKeys.all(100), "issuer-listings", [...routeIds].sort().join(",")] as const,
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
  /** The account's promises it can work on in a garden: the Start step's list and the link check. */
  workablePromises: (
    chainId: number,
    account: Address | string | undefined,
    workGarden: Address | string | undefined,
    returnGarden: Address | string | undefined
  ) =>
    [
      ...commitmentPoolingKeys.all(chainId),
      "workable-promises",
      normalizeAddress(account),
      normalizeAddress(workGarden),
      normalizeAddress(returnGarden),
    ] as const,
  linkedWorks: (chainId: number, workUIDs: readonly string[]) =>
    [...commitmentPoolingKeys.all(chainId), "linked-works", workUIDs.join(",")] as const,
  /** The device's own queue, read per account rather than per chain. */
  queueState: (account: string | null | undefined) =>
    ["greengoods", "commitment-pooling", "queue", account?.toLowerCase() ?? null] as const,
  /**
   * The copies of each display group still waiting in that queue on a chain.
   * Under the queue's key, so every refresh of the queue refreshes this too.
   */
  queuedGroupCopies: (account: string | null | undefined, chainId: number) =>
    [...commitmentPoolingKeys.queueState(account), "group-copies", chainId] as const,
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
  gardenerDelivery: (sourceChainId: number, destinationChainId: number) =>
    [...commitmentPoolingKeys.all(sourceChainId), "gardener-delivery", destinationChainId] as const,
  gardenerSettlementHistory: (chainId: number, account: Address | string) =>
    [
      ...commitmentPoolingKeys.all(chainId),
      "gardener-settlement-history",
      normalizeAddress(account),
    ] as const,
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
  /**
   * The settlement module's own answer for one commitment: its plan, the
   * frozen rows, the queued children and the delivery gate, read from the
   * chain so a steward resumes from the truth rather than from the index.
   */
  settlementChain: (chainId: number, commitmentId: bigint | string | number) =>
    [...commitmentPoolingKeys.all(chainId), "settlement-chain", String(commitmentId)] as const,
  /** Owner, pause flag and gardener-delivery gate of the settlement module. */
  settlementOperations: (chainId: number) =>
    [...commitmentPoolingKeys.all(chainId), "settlement-operations"] as const,
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
