import type { QueryKey } from "@tanstack/react-query";
import {
  Capital,
  CynefinPhase,
  DEFAULT_CHAIN_ID,
  Domain,
  queryKeys,
  type Action,
  type Address,
  type Garden,
  type GardenAssessment,
  type GardenCommunity,
  type GardenSignalPool,
  type GardenVault,
  type HypercertRecord,
  PoolType,
  type Work,
  WeightScheme,
  type YieldAllocation,
} from "../src";
import { daysAgo, daysFromNow, FIXTURE_IMAGE_AGROFORESTRY } from "./fixtures";

export const STORYBOOK_OPERATOR_ADDRESS =
  "0x04D60647836bcA09c37B379550038BdaaFD82503" as Address;

const STORYBOOK_OPERATOR_ADDRESS_KEY = STORYBOOK_OPERATOR_ADDRESS.toLowerCase() as Address;

const RIO_GARDEN_ADDRESS = "0xabcd1234567890123456789012345678901234ef" as Address;
const BOTANIC_GARDEN_ADDRESS = "0xbcde2345678901234567890123456789012345f0" as Address;
const RIO_COMMUNITY_ADDRESS = "0xcdef3456789012345678901234567890123456a1" as Address;
const RIO_ACTION_POOL_ADDRESS = "0xdefa4567890123456789012345678901234567b2" as Address;
const RIO_HYPERCERT_POOL_ADDRESS = "0xefab5678901234567890123456789012345678c3" as Address;
const RIO_VAULT_ADDRESS = "0xfabc6789012345678901234567890123456789d4" as Address;
const STORYBOOK_ASSET_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export const STORYBOOK_ADMIN_GARDENS: Garden[] = [
  {
    id: RIO_GARDEN_ADDRESS,
    chainId: DEFAULT_CHAIN_ID,
    tokenAddress: RIO_GARDEN_ADDRESS,
    tokenID: 1n,
    name: "Rio Rainforest Lab",
    description: "Field operators coordinating agroforestry work.",
    location: "Costa Rica",
    bannerImage: FIXTURE_IMAGE_AGROFORESTRY,
    createdAt: daysAgo(90),
    gardeners: [STORYBOOK_OPERATOR_ADDRESS],
    operators: [STORYBOOK_OPERATOR_ADDRESS],
    evaluators: [STORYBOOK_OPERATOR_ADDRESS],
    owners: [STORYBOOK_OPERATOR_ADDRESS],
    funders: [],
    communities: [],
    assessments: [],
    works: [],
    domainMask: 2,
    openJoining: true,
  },
  {
    id: BOTANIC_GARDEN_ADDRESS,
    chainId: DEFAULT_CHAIN_ID,
    tokenAddress: BOTANIC_GARDEN_ADDRESS,
    tokenID: 2n,
    name: "Botanic Commons",
    description: "Urban canopy and water resilience work.",
    location: "Brazil",
    bannerImage: FIXTURE_IMAGE_AGROFORESTRY,
    createdAt: daysAgo(45),
    gardeners: [STORYBOOK_OPERATOR_ADDRESS],
    operators: [STORYBOOK_OPERATOR_ADDRESS],
    evaluators: [],
    owners: [STORYBOOK_OPERATOR_ADDRESS],
    funders: [],
    communities: [],
    assessments: [],
    works: [],
    domainMask: 5,
    openJoining: false,
  },
];

export const STORYBOOK_PRIMARY_ADMIN_GARDEN = STORYBOOK_ADMIN_GARDENS[0] as Garden;

export const STORYBOOK_ADMIN_ACTIONS: Action[] = [
  {
    id: "action-canopy-baseline",
    slug: "canopy-baseline",
    title: "Canopy baseline",
    description: "Record canopy health and planting coordinates.",
    instructions: "Capture a short field note and at least one media artifact.",
    startTime: daysAgo(7),
    endTime: daysFromNow(30),
    capitals: [Capital.LIVING, Capital.INTELLECTUAL],
    media: [FIXTURE_IMAGE_AGROFORESTRY],
    domain: Domain.AGRO,
    createdAt: daysAgo(14),
    inputs: [],
  },
  {
    id: "action-water-quality",
    slug: "water-quality",
    title: "Water quality check",
    description: "Review water measurements from the current reporting window.",
    instructions: "Add pH, turbidity, and site notes.",
    startTime: daysAgo(3),
    endTime: daysFromNow(14),
    capitals: [Capital.LIVING, Capital.MATERIAL],
    media: [],
    domain: Domain.WASTE,
    createdAt: daysAgo(10),
    inputs: [],
  },
];

export const STORYBOOK_ADMIN_ASSESSMENTS: GardenAssessment[] = [
  {
    id: "assessment-rio-canopy",
    schemaVersion: "assessment_v2",
    authorAddress: STORYBOOK_OPERATOR_ADDRESS,
    gardenAddress: RIO_GARDEN_ADDRESS,
    title: "Rainforest canopy strategy",
    description: "Quarterly assessment for canopy health and field operations.",
    diagnosis: "Fragmented canopy cover needs coordinated restoration work.",
    smartOutcomes: [
      {
        description: "Restore native canopy coverage",
        metric: "canopy-cover",
        target: 12,
      },
    ],
    cynefinPhase: CynefinPhase.COMPLEX,
    domain: Domain.AGRO,
    selectedActionUIDs: ["action-canopy-baseline"],
    reportingPeriod: {
      start: daysAgo(30),
      end: daysFromNow(30),
    },
    sdgTargets: [13, 15],
    attachments: [],
    location: "Costa Rica",
    createdAt: daysAgo(12),
  },
];

export const STORYBOOK_ADMIN_WORKS: Work[] = [
  {
    id: "work-rio-canopy-1",
    title: "Canopy transect upload",
    actionUID: 1,
    gardenerAddress: STORYBOOK_OPERATOR_ADDRESS,
    gardenAddress: RIO_GARDEN_ADDRESS,
    feedback: "Uploaded canopy measurements and photos from plot A.",
    metadata: JSON.stringify({
      schemaVersion: "work_metadata_v2",
      actionSlug: "canopy-baseline",
      timeSpentMinutes: 95,
      details: { plot: "A", canopyCover: 42 },
      submittedAt: new Date(daysAgo(2) * 1000).toISOString(),
    }),
    media: [FIXTURE_IMAGE_AGROFORESTRY],
    createdAt: daysAgo(2),
    status: "pending",
  },
  {
    id: "work-rio-water-1",
    title: "Water quality review",
    actionUID: 2,
    gardenerAddress: STORYBOOK_OPERATOR_ADDRESS,
    gardenAddress: RIO_GARDEN_ADDRESS,
    feedback: "Submitted pH and turbidity readings for the north stream.",
    metadata: JSON.stringify({
      schemaVersion: "work_metadata_v2",
      actionSlug: "water-quality",
      timeSpentMinutes: 60,
      details: { pH: 7.1, turbidity: "low" },
      submittedAt: new Date(daysAgo(5) * 1000).toISOString(),
    }),
    media: [],
    createdAt: daysAgo(5),
    status: "approved",
  },
  {
    id: "work-rio-maintenance-1",
    title: "Trail maintenance note",
    actionUID: 1,
    gardenerAddress: STORYBOOK_OPERATOR_ADDRESS,
    gardenAddress: RIO_GARDEN_ADDRESS,
    feedback: "Cleared access path for the next planting session.",
    metadata: JSON.stringify({
      schemaVersion: "work_metadata_v2",
      actionSlug: "canopy-baseline",
      timeSpentMinutes: 45,
      details: { section: "ridge" },
      submittedAt: new Date(daysAgo(9) * 1000).toISOString(),
    }),
    media: [],
    createdAt: daysAgo(9),
    status: "approved",
  },
];

export const STORYBOOK_ADMIN_HYPERCERTS: HypercertRecord[] = [
  {
    id: "hypercert-rio-baseline",
    tokenId: 1001n,
    gardenId: RIO_GARDEN_ADDRESS,
    metadataUri: "ipfs://bafy-rio-baseline",
    imageUri: FIXTURE_IMAGE_AGROFORESTRY,
    mintedAt: daysAgo(4),
    mintedBy: STORYBOOK_OPERATOR_ADDRESS,
    txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    totalUnits: 1000n,
    claimedUnits: 250n,
    attestationCount: 2,
    attestationUIDs: ["work-rio-water-1", "work-rio-maintenance-1"],
    title: "Rainforest canopy baseline",
    description: "Certified work package for canopy and water quality monitoring.",
    workScopes: ["Canopy", "Water"],
    status: "active",
    allowlistEntries: [],
  },
];

export const STORYBOOK_ADMIN_VAULTS: GardenVault[] = [
  {
    id: "vault-rio-native",
    chainId: DEFAULT_CHAIN_ID,
    garden: RIO_GARDEN_ADDRESS,
    asset: STORYBOOK_ASSET_ADDRESS,
    vaultAddress: RIO_VAULT_ADDRESS,
    totalDeposited: 42_000000000000000000n,
    totalWithdrawn: 3_000000000000000000n,
    totalHarvestCount: 3,
    donationAddress: null,
    depositorCount: 8,
    paused: false,
    createdAt: daysAgo(60),
  },
];

export const STORYBOOK_ADMIN_ALLOCATIONS: YieldAllocation[] = [
  {
    gardenAddress: RIO_GARDEN_ADDRESS,
    assetAddress: STORYBOOK_ASSET_ADDRESS,
    cookieJarAmount: 2_000000000000000000n,
    fractionsAmount: 2_000000000000000000n,
    juiceboxAmount: 100000000000000000n,
    totalAmount: 4_100000000000000000n,
    timestamp: daysAgo(6),
    txHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
  },
];

export const STORYBOOK_ADMIN_COMMUNITY: GardenCommunity = {
  gardenAddress: RIO_GARDEN_ADDRESS,
  communityAddress: RIO_COMMUNITY_ADDRESS,
  goodsTokenAddress: STORYBOOK_ASSET_ADDRESS,
  weightScheme: WeightScheme.Linear,
  stakeAmount: 1_000000000000000000n,
};

export const STORYBOOK_ADMIN_POOLS: GardenSignalPool[] = [
  {
    poolAddress: RIO_ACTION_POOL_ADDRESS,
    poolType: PoolType.Action,
    gardenAddress: RIO_GARDEN_ADDRESS,
    communityAddress: RIO_COMMUNITY_ADDRESS,
  },
  {
    poolAddress: RIO_HYPERCERT_POOL_ADDRESS,
    poolType: PoolType.Hypercert,
    gardenAddress: RIO_GARDEN_ADDRESS,
    communityAddress: RIO_COMMUNITY_ADDRESS,
  },
];

export const STORYBOOK_ADMIN_SHELL_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  [queryKeys.gardens.byChain(DEFAULT_CHAIN_ID), STORYBOOK_ADMIN_GARDENS],
  [queryKeys.actions.byChain(DEFAULT_CHAIN_ID), STORYBOOK_ADMIN_ACTIONS],
  [queryKeys.assessments.byChain(DEFAULT_CHAIN_ID), STORYBOOK_ADMIN_ASSESSMENTS],
  [
    queryKeys.assessments.byGardenBase(RIO_GARDEN_ADDRESS, DEFAULT_CHAIN_ID),
    STORYBOOK_ADMIN_ASSESSMENTS,
  ],
  [queryKeys.works.merged(RIO_GARDEN_ADDRESS, DEFAULT_CHAIN_ID), STORYBOOK_ADMIN_WORKS],
  [
    queryKeys.hypercerts.list(RIO_GARDEN_ADDRESS, DEFAULT_CHAIN_ID, undefined),
    STORYBOOK_ADMIN_HYPERCERTS,
  ],
  [
    [...queryKeys.hypercerts.all, "metadata", "list", DEFAULT_CHAIN_ID, "hypercert-rio-baseline"],
    {
      "hypercert-rio-baseline": STORYBOOK_ADMIN_HYPERCERTS[0],
    },
  ],
  [queryKeys.vaults.byGarden(RIO_GARDEN_ADDRESS, DEFAULT_CHAIN_ID), STORYBOOK_ADMIN_VAULTS],
  [
    queryKeys.yield.allocations(RIO_GARDEN_ADDRESS, DEFAULT_CHAIN_ID, 20),
    STORYBOOK_ADMIN_ALLOCATIONS,
  ],
  [queryKeys.community.garden(RIO_GARDEN_ADDRESS, DEFAULT_CHAIN_ID), STORYBOOK_ADMIN_COMMUNITY],
  [queryKeys.community.pools(RIO_GARDEN_ADDRESS, DEFAULT_CHAIN_ID), STORYBOOK_ADMIN_POOLS],
  [queryKeys.conviction.strategies(RIO_GARDEN_ADDRESS, DEFAULT_CHAIN_ID), []],
  [
    queryKeys.role.operatorGardens(STORYBOOK_OPERATOR_ADDRESS_KEY, DEFAULT_CHAIN_ID),
    STORYBOOK_ADMIN_GARDENS.map((garden) => ({ id: garden.id, name: garden.name })),
  ],
  [
    queryKeys.role.deploymentPermissions(STORYBOOK_OPERATOR_ADDRESS_KEY, DEFAULT_CHAIN_ID),
    { isOwner: false, isInAllowlist: false, canDeploy: false },
  ],
  [queryKeys.ens.name(STORYBOOK_OPERATOR_ADDRESS_KEY), "operator.greengoods.eth"],
  [queryKeys.ens.avatar(STORYBOOK_OPERATOR_ADDRESS_KEY), null],
];
