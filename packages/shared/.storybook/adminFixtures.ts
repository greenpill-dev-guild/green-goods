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
} from "../src";
import { daysAgo, daysFromNow, FIXTURE_IMAGE_AGROFORESTRY } from "./fixtures";

export const STORYBOOK_OPERATOR_ADDRESS =
  "0x04D60647836bcA09c37B379550038BdaaFD82503" as Address;

const STORYBOOK_OPERATOR_ADDRESS_KEY = STORYBOOK_OPERATOR_ADDRESS.toLowerCase() as Address;

const RIO_GARDEN_ADDRESS = "0xabcd1234567890123456789012345678901234ef" as Address;
const BOTANIC_GARDEN_ADDRESS = "0xbcde2345678901234567890123456789012345f0" as Address;

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

export const STORYBOOK_ADMIN_SHELL_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  [queryKeys.gardens.byChain(DEFAULT_CHAIN_ID), STORYBOOK_ADMIN_GARDENS],
  [queryKeys.actions.byChain(DEFAULT_CHAIN_ID), STORYBOOK_ADMIN_ACTIONS],
  [queryKeys.assessments.byChain(DEFAULT_CHAIN_ID), STORYBOOK_ADMIN_ASSESSMENTS],
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
