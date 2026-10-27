import {
  type ServiceIssuerAction,
  type ServiceIssuerAsset,
  type ServiceIssuerBooking,
  type ServiceIssuerDraft,
  type ServiceIssuerDraftRecord,
  type ServiceIssuerReview,
  type ServiceIssuerSignedApproval,
  type ServiceIssuerSnapshot,
  serviceIssuerTermsDigest,
} from "@green-goods/shared/commitment-pooling";

export const ISSUER_STORY_ADDRESS = "0x1111111111111111111111111111111111111111";
export const ISSUER_STORY_HASH = `0x${"ab".repeat(32)}` as const;
const token = "0x2222222222222222222222222222222222222222";

/** Fictional Storybook participants and receipts; never inserted into the production catalog. */
export const issuerStoryAssets: readonly ServiceIssuerAsset[] = [
  {
    id: "engineer-help",
    kind: "individual",
    ownerReserve: ISSUER_STORY_ADDRESS,
    sourceAuthority: ISSUER_STORY_ADDRESS,
    name: "Fictional engineer help",
    symbol: "EHELP",
    decimals: 6,
    token: {
      address: token,
      owner: ISSUER_STORY_ADDRESS,
      factoryDeployment: {
        deployer: ISSUER_STORY_ADDRESS,
        admin: ISSUER_STORY_ADDRESS,
        salt: ISSUER_STORY_HASH,
        initializer: "0x",
      },
      receipt: {
        transactionHash: ISSUER_STORY_HASH,
        blockHash: ISSUER_STORY_HASH,
        blockNumber: 1n,
      },
      runtimeCodeHash: ISSUER_STORY_HASH,
      implementation: { address: token, runtimeCodeHash: ISSUER_STORY_HASH },
    },
    service: {
      unit: "minutes",
      terms: { reference: "fictional-engineer-lesson", digest: ISSUER_STORY_HASH },
      capacityConfirmed: true,
      approval: { reference: "fictional-engineer-consent", digest: ISSUER_STORY_HASH },
    },
    initialSupply: 6_000_000n,
    adapterAllowance: 1_000_000n,
    poolHoldingCap: 5_000_000n,
    priceIndex: 2_000_000n,
    upgradeControl: { kind: "member", admin: ISSUER_STORY_ADDRESS },
  },
  {
    id: "analyst-help",
    kind: "individual",
    ownerReserve: "0x3333333333333333333333333333333333333333",
    sourceAuthority: "0x3333333333333333333333333333333333333333",
    name: "Fictional analyst coaching",
    symbol: "AHELP",
    decimals: 6,
    token: {
      address: "0x4444444444444444444444444444444444444444",
      owner: "0x3333333333333333333333333333333333333333",
      factoryDeployment: {
        deployer: ISSUER_STORY_ADDRESS,
        admin: "0x3333333333333333333333333333333333333333",
        salt: ISSUER_STORY_HASH,
        initializer: "0x",
      },
      receipt: {
        transactionHash: ISSUER_STORY_HASH,
        blockHash: ISSUER_STORY_HASH,
        blockNumber: 1n,
      },
      runtimeCodeHash: ISSUER_STORY_HASH,
      implementation: { address: token, runtimeCodeHash: ISSUER_STORY_HASH },
    },
    service: {
      unit: "minutes",
      terms: { reference: "fictional-coaching", digest: ISSUER_STORY_HASH },
      capacityConfirmed: true,
      approval: { reference: "fictional-analyst-consent", digest: ISSUER_STORY_HASH },
    },
    initialSupply: 6_000_000n,
    adapterAllowance: 1_000_000n,
    poolHoldingCap: 5_000_000n,
    priceIndex: 1_000_000n,
    upgradeControl: { kind: "member", admin: "0x3333333333333333333333333333333333333333" },
  },
];

export function issuerStorySnapshot(): Extract<ServiceIssuerSnapshot, { evidence: "onchain" }> {
  return {
    evidence: "onchain",
    actor: { address: ISSUER_STORY_ADDRESS, routeId: "fictional-story", assetId: "engineer-help" },
    asset: issuerStoryAssets[0],
    holdingBalance: 3_500_000n,
    issuerReserveBalance: 3_500_000n,
    totalMinted: 6_000_000n,
    reserveAllowance: 500_000n,
    poolAllowance: 0n,
    reserveEnabled: true,
    configuredReserveAuthority: ISSUER_STORY_ADDRESS,
    registeredSourceAuthority: ISSUER_STORY_ADDRESS,
    pool: { admitted: true, limit: 5_000_000n, holding: 1_000_000n },
    pending: null,
    bookings: {
      status: "observed",
      completeness: "unknown",
      records: [
        {
          setupId: ISSUER_STORY_HASH,
          authorizationHash: ISSUER_STORY_HASH,
          authorization: {
            version: 2,
            sourceChainId: 42161,
            sourceModule: token,
            coreModule: token,
            commitmentId: 1030n,
            termsRevision: 1n,
            termsHash: ISSUER_STORY_HASH,
            claimHash: ISSUER_STORY_HASH,
            requestNonce: 1n,
            buyer: "0x5555555555555555555555555555555555555555",
            buyerGarden: token,
            providerGarden: token,
            destinationChainId: 100,
            destinationEscrow: token,
            issuer: ISSUER_STORY_ADDRESS,
            token,
            serviceUnits: 60n,
            voucherUnits: 1_000_000n,
            holder: "0x5555555555555555555555555555555555555555",
            unitLabelHash: ISSUER_STORY_HASH,
            serviceTermsRef: ISSUER_STORY_HASH,
            remedyTermsRef: ISSUER_STORY_HASH,
            acceptanceDeadline: 1_900_000_300n,
            remedyPolicy: 1,
          },
          result: {
            sequence: 1n,
            phase: "authorized",
            issuerApproved: false,
            decision: "none",
            depositReceiptHash: null,
            depositedUnits: 0n,
            setupRefundedUnits: 0n,
            appliedDecisionId: null,
            actionSucceeded: true,
            failureHash: null,
          },
          issuerReturnCeiling: 0n,
          finalAllocation: null,
          reviewedTermsMatch: true,
          approvalEligible: true,
          returnEligible: false,
        },
      ],
    },
  };
}

export function issuerStoryReview(action: ServiceIssuerAction): ServiceIssuerReview {
  return {
    version: 1,
    evidence: "live-review",
    actor: issuerStorySnapshot().actor,
    action,
    session: "fictional-story-session",
    configuration: ISSUER_STORY_HASH,
    state: ISSUER_STORY_HASH,
    expected: {},
    expiresAt: 1_900_000_300n,
    fingerprint: ISSUER_STORY_HASH,
    call: {
      chainId: 100,
      account: ISSUER_STORY_ADDRESS,
      address: token,
      abi: [],
      value: 0n,
      functionName: action.kind,
      args: [],
    },
  };
}

const MAYA = "0x5555555555555555555555555555555555555555";
const RAFA = "0x7777777777777777777777777777777777777777";
const KAI = "0x8888888888888888888888888888888888888888";
/** Fictional names the stories resolve the holders' addresses to. */
export const ISSUER_STORY_NAMES: Readonly<Record<string, string>> = {
  [MAYA]: "Maya Ruiz",
  [RAFA]: "Rafa",
  [KAI]: "Kai",
};
const hash = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as const;

/** One booking on the fictional service, in the state a story needs. */
function booking(
  n: number,
  holder: string,
  state: "asked" | "approved" | "deposited" | "active" | "proposed" | "delivered"
): ServiceIssuerBooking {
  const base = issuerStorySnapshot().bookings.records[0]!;
  const approved = state !== "asked";
  const deposited = state === "deposited" || state === "active" || state === "proposed";
  return {
    ...base,
    setupId: hash(n),
    authorizationHash: hash(n + 100),
    authorization: {
      ...base.authorization,
      commitmentId: 1030n + BigInt(n),
      holder: holder as `0x${string}`,
      buyer: holder as `0x${string}`,
    },
    result: {
      ...base.result,
      phase:
        state === "active" || state === "proposed" || state === "delivered"
          ? "active"
          : deposited
            ? "deposited"
            : "authorized",
      issuerApproved: approved,
      decision:
        state === "active" || state === "proposed" || state === "delivered" ? "activate" : "none",
      depositedUnits: deposited || state === "delivered" ? 1_000_000n : 0n,
    },
    issuerReturnCeiling: state === "proposed" ? 500_000n : 0n,
    finalAllocation:
      state === "delivered"
        ? {
            decisionId: ISSUER_STORY_HASH,
            activationDecisionId: ISSUER_STORY_HASH,
            issuerReturnApprovalAtFreeze: 0n,
            allocation: {
              approvedDeliveredServiceUnits: 60n,
              releaseVoucherUnits: 1_000_000n,
              refundVoucherUnits: 0n,
            },
            release: { state: "succeeded", attempts: 1n, failureHash: null },
            refund: { state: "not-required", attempts: 0n, failureHash: null },
            financiallyClosed: true,
          }
        : null,
    approvalEligible: state === "asked",
    returnEligible: approved && state !== "delivered",
  };
}

export type IssuerServiceStory =
  | "overview"
  | "approve"
  | "proposed"
  | "pending"
  | "paused"
  | "delisted"
  | "short"
  | "setup"
  | "admitting"
  | "full";

/**
 * The member's service in each state the design draws: six promised, one delivered, and the
 * bookings, reserve and pool that state calls for. Fictional; nothing here is a live record.
 */
export function issuerServiceStory(state: IssuerServiceStory) {
  const snapshot = issuerStorySnapshot();
  const records = [
    booking(1, MAYA, state === "approve" || state === "pending" ? "asked" : "deposited"),
    booking(2, RAFA, state === "proposed" ? "proposed" : "active"),
    booking(3, KAI, "delivered"),
  ];
  snapshot.issuerReserveBalance = 4_000_000n;
  snapshot.holdingBalance = 4_000_000n;
  snapshot.totalMinted = state === "full" ? 6_000_000n : 5_000_000n;
  snapshot.reserveAllowance = state === "short" ? 0n : 1_000_000n;
  snapshot.pool = { admitted: true, limit: 6_000_000n, holding: 1_000_000n };
  snapshot.bookings = { status: "observed", completeness: "unknown", records };
  if (state === "pending")
    snapshot.pending = {
      version: 1,
      actor: snapshot.actor,
      review: issuerStoryReview({
        kind: "approveBooking",
        setupId: records[0]!.setupId,
        authorizationHash: records[0]!.authorizationHash,
      }),
    };
  if (state === "paused") snapshot.reserveEnabled = false;
  if (state === "delisted") snapshot.pool = { ...snapshot.pool, limit: 0n };
  if (state === "setup" || state === "admitting") {
    snapshot.reserveEnabled = false;
    snapshot.reserveAllowance = 0n;
    snapshot.issuerReserveBalance = 6_000_000n;
    snapshot.holdingBalance = 6_000_000n;
    snapshot.totalMinted = 6_000_000n;
    snapshot.pool = {
      admitted: state === "setup",
      limit: state === "setup" ? 6_000_000n : 0n,
      holding: 0n,
    };
    snapshot.bookings = { status: "observed", completeness: "unknown", records: [] };
  }
  return snapshot;
}

/** A fictional member's draft: an integration lesson, prepared with a fictional steward. */
function issuerStoryDraft(revision = 1): ServiceIssuerDraft {
  return {
    version: 1,
    id: "7",
    member: ISSUER_STORY_ADDRESS,
    memberName: "Teo Alves",
    preparedBy: "Kaya",
    garden: "Green Goods",
    sourceChainId: 42161,
    sentAt: 1_792_800_000n,
    changed: revision > 1 ? ["priceIndex"] : [],
    terms: {
      revision,
      service: {
        title: "Integration lesson",
        buys: "One 60-minute lesson",
        scope: "Remote, within 2 weeks of booking",
        remedy: "By minutes delivered",
        unit: "minutes",
      },
      token: { name: "Teo vouchers", symbol: "TEO", decimals: 6 },
      capacity: { units: 6_000_000n, weeks: 4 },
      issue: { total: 6_000_000n, pool: 2_000_000n },
      rewardAllowance: 1_000_000n,
      poolHoldingCap: 6_000_000n,
      priceIndex: revision > 1 ? 3_000_000n : 2_000_000n,
      poolFee: 0n,
      replyBusinessDays: 2,
      acceptanceDays: 7,
      document: {
        reference: "https://example.org/fictional-lesson-terms",
        digest: ISSUER_STORY_HASH,
      },
    },
  };
}

/** The draft as the member finds it: to review, approved, changed since approving, or declined. */
export function issuerStoryDraftRecord(
  state: "review" | "approved" | "changed" | "declined"
): ServiceIssuerDraftRecord {
  const approval: ServiceIssuerSignedApproval = {
    version: 1,
    draftId: "7",
    revision: 1,
    member: ISSUER_STORY_ADDRESS,
    service: "Integration lesson",
    termsDigest: serviceIssuerTermsDigest(issuerStoryDraft(1)),
    signedAt: 1_792_886_400n,
    signature: `0x${"5".repeat(130)}`,
  };
  return {
    draft: issuerStoryDraft(state === "changed" ? 2 : 1),
    approval: state === "approved" || state === "changed" ? approval : null,
    declinedAt: state === "declined" ? 1_792_886_400n : null,
  };
}
