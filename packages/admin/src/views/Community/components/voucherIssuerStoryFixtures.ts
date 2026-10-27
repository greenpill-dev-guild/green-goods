import {
  type ServiceIssuerAsset,
  type ServiceIssuerDraft,
  type ServiceIssuerDraftRecord,
  type ServiceIssuerListings,
  type ServiceIssuerPoolListing,
  type ServiceIssuerRoute,
  serviceIssuerListingKey,
  serviceIssuerTermsDigest,
} from "@green-goods/shared/commitment-pooling";
import type { Address } from "@green-goods/shared/types/domain";
import { getAddress, type Hex } from "viem";

const account = (n: number): Address =>
  getAddress(`0x${n.toString(16).padStart(40, "0")}`) as Address;
const digest = (n: number): Hex => `0x${n.toString(16).padStart(64, "0")}`;
const member = account(1),
  ownerSafe = account(2),
  guardian = account(3),
  router = account(4),
  maya = account(5);
type ServiceDeploymentPin = ServiceIssuerRoute["assets"][number]["token"];
const pin = (n: number, owner = ownerSafe): ServiceDeploymentPin => ({
  address: account(n),
  owner,
  runtimeCodeHash: digest(n),
  implementation: { address: account(n + 100), runtimeCodeHash: digest(n + 100) },
  receipt: { transactionHash: digest(n + 200), blockHash: digest(n + 300), blockNumber: 1n },
  factoryDeployment: { deployer: account(8), admin: owner, salt: digest(n), initializer: "0x" },
});

/** One reviewed issuer asset and the receipt-backed service asset it must match. */
function issuer(
  n: number,
  input: {
    id: string;
    name: string;
    symbol: string;
    owner: Address;
    kind: "individual" | "collective";
    unit: string;
  }
) {
  const token = pin(n, input.owner);
  const asset: ServiceIssuerAsset = {
    id: input.id,
    kind: input.kind,
    ownerReserve: input.owner,
    sourceAuthority: input.owner,
    token,
    name: input.name,
    symbol: input.symbol,
    decimals: 6,
    service: {
      unit: input.unit,
      capacityConfirmed: true,
      terms: { reference: `https://example.org/${input.id}-terms`, digest: digest(n + 20) },
      approval: {
        reference: `issuer-approval:100:${input.owner.toLowerCase()}:7:1`,
        digest: digest(n + 21),
      },
    },
    initialSupply: input.kind === "collective" ? 20_000_000n : 6_000_000n,
    adapterAllowance: 1_000_000n,
    poolHoldingCap: 6_000_000n,
    priceIndex: input.kind === "collective" ? 1_000_000n : 2_000_000n,
    upgradeControl:
      input.kind === "collective"
        ? { kind: "collective-safe", admin: input.owner }
        : { kind: "member", admin: input.owner },
  };
  const service = {
    token: token.address,
    issuer: input.owner,
    symbol: input.symbol,
    decimals: 6,
    runtimeCodeHash: token.runtimeCodeHash,
    implementation: token.implementation,
  };
  return { asset, service };
}

function route(issuers: ReturnType<typeof issuer>[]): ServiceIssuerRoute {
  return {
    service: {
      id: "fictional-member-issuer",
      revision: 1,
      sourceChainId: 42161,
      core: pin(11),
      source: { ...pin(12), guardian, router, remoteSelector: 100n },
      destination: { ...pin(13), guardian, router, remoteSelector: 42161n },
      assets: issuers.map((entry) => entry.service),
      buyerGardens: [],
    },
    factory: { address: account(14), runtimeCodeHash: digest(14) },
    adapterSource: { ...pin(15), guardian, router, remoteSelector: 100n },
    adapter: { ...pin(16), guardian, router, sourcePeer: account(15), sourceSelector: 42161n },
    assets: issuers.map((entry) => entry.asset),
    pool: {
      proxyAdmin: ownerSafe,
      deployment: pin(30),
      registry: pin(31),
      limiter: pin(32),
      quoter: pin(33),
      feePolicy: pin(34),
      protocolFee: pin(35),
      feeAddress: ownerSafe,
      feesDecoupled: true,
    },
  };
}

/** Fictional metadata only; never imported by the live issuer catalog. */
export function voucherIssuerStoryRoute(): ServiceIssuerRoute {
  const teo = issuer(10, {
    id: "fictional-engineer",
    name: "Fictional integration lesson",
    symbol: "DEMO",
    owner: member,
    kind: "individual",
    unit: "minute",
  });
  return route([teo]);
}

export type VoucherIssuerStory =
  | "issuers"
  | "prepareDraft"
  | "awaitingTeo"
  | "approved"
  | "ownerSafeDrafts"
  | "listed"
  | "delist"
  | "delisted";

/** The pool's four issuers as the lab draws them: two gardens, Teo and Maya. Fictional. */
export function voucherIssuerStory(state: VoucherIssuerStory): {
  routes: ServiceIssuerRoute[];
  drafts: ServiceIssuerDraftRecord[];
  listings: ServiceIssuerListings;
} {
  const teoListed = state === "ownerSafeDrafts" || state === "listed";
  const issuers = [
    issuer(40, {
      id: "tech-and-sun",
      name: "Tech and Sun vouchers",
      symbol: "TSUN",
      owner: account(41),
      kind: "collective",
      unit: "hub day",
    }),
    issuer(50, {
      id: "green-goods",
      name: "Green Goods vouchers",
      symbol: "GGV",
      owner: account(51),
      kind: "collective",
      unit: "session",
    }),
    ...(teoListed
      ? [
          issuer(60, {
            id: "teo",
            name: "Teo vouchers",
            symbol: "TEO",
            owner: member,
            kind: "individual",
            unit: "minutes",
          }),
        ]
      : []),
    issuer(70, {
      id: "maya",
      name: "Maya vouchers",
      symbol: "MAYA",
      owner: maya,
      kind: "individual",
      unit: "minutes",
    }),
  ];
  const catalog = route(issuers);
  const listing = (
    admitted: boolean,
    limit: bigint,
    holding: bigint
  ): ServiceIssuerPoolListing => ({
    admitted,
    limit,
    holding,
  });
  const listings = new Map<string, ServiceIssuerPoolListing>([
    [
      serviceIssuerListingKey(catalog.service.id, "tech-and-sun"),
      listing(true, 20_000_000n, 8_000_000n),
    ],
    [
      serviceIssuerListingKey(catalog.service.id, "green-goods"),
      listing(true, 20_000_000n, 6_000_000n),
    ],
    [
      serviceIssuerListingKey(catalog.service.id, "teo"),
      listing(
        state === "listed",
        state === "listed" ? 6_000_000n : 0n,
        state === "listed" ? 2_000_000n : 0n
      ),
    ],
    [
      serviceIssuerListingKey(catalog.service.id, "maya"),
      listing(true, state === "delisted" ? 0n : 6_000_000n, 4_000_000n),
    ],
  ]);
  const draft: ServiceIssuerDraft = {
    version: 1,
    id: "7",
    member,
    memberName: "Teo Alves",
    preparedBy: "Kaya",
    garden: "Green Goods",
    sourceChainId: 42161,
    sentAt: state === "prepareDraft" ? null : 1_792_800_000n,
    changed: [],
    terms: {
      revision: 1,
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
      priceIndex: 2_000_000n,
      poolFee: 0n,
      replyBusinessDays: 2,
      acceptanceDays: 7,
      document: { reference: "https://example.org/teo-terms", digest: digest(99) },
    },
  };
  const approved = state === "approved" || teoListed;
  const drafts: ServiceIssuerDraftRecord[] = [
    {
      draft,
      approval: approved
        ? {
            version: 1,
            draftId: "7",
            revision: 1,
            member,
            service: "Integration lesson",
            termsDigest: serviceIssuerTermsDigest(draft),
            signedAt: 1_792_886_400n,
            signature: `0x${"5".repeat(130)}`,
          }
        : null,
      declinedAt: null,
    },
  ];
  return { routes: [catalog], drafts, listings };
}
