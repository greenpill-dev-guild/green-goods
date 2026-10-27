import type {
  ServiceIssuerAction,
  ServiceIssuerAsset,
  ServiceIssuerReview,
  ServiceIssuerSnapshot,
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
