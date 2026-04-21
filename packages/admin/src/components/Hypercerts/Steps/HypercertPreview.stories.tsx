import {
  type Address,
  type AllowlistEntry,
  CynefinPhase,
  Domain,
  type GardenAssessment,
  type HypercertMetadata,
  TOTAL_UNITS,
} from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withRouter } from "../../../../../shared/.storybook/decorators";
import { FIXTURE_IMAGE_AGROFORESTRY } from "../../../../../shared/.storybook/fixtures";
import { HypercertPreview } from "./HypercertPreview";

const GARDEN_ID = "0x1234567890123456789012345678901234567890" as Address;

const METADATA: HypercertMetadata = {
  name: "Q1 Restoration Impact",
  description:
    "Bundled attestations from the March planting cohort and aggregated survival checks.",
  image: FIXTURE_IMAGE_AGROFORESTRY,
  hypercert: {
    work_scope: { value: ["planting", "survival-check"], excludes: [] },
    impact_scope: { value: ["carbon-sequestration", "biodiversity"], excludes: [] },
    work_timeframe: { value: [1_704_067_200, 1_711_843_200], display_value: "Jan 2026 – Mar 2026" },
    impact_timeframe: { value: [1_704_067_200, 0], display_value: "" },
    contributors: { value: ["0x1111…", "0x2222…"], excludes: [] },
    rights: { value: ["Public Display", "Transfer"], excludes: [] },
  },
};

const ALLOWLIST: AllowlistEntry[] = [
  {
    address: "0x1111111111111111111111111111111111111111" as Address,
    units: 45_000_000n,
    label: "Lead gardener",
  },
  {
    address: "0x2222222222222222222222222222222222222222" as Address,
    units: 30_000_000n,
    label: "Operator",
  },
  {
    address: "0x3333333333333333333333333333333333333333" as Address,
    units: 25_000_000n,
    label: "Community",
  },
];

const ASSESSMENT: GardenAssessment = {
  id: "0xassess1",
  schemaVersion: "assessment_v2",
  authorAddress: "0x1111111111111111111111111111111111111111" as Address,
  gardenAddress: GARDEN_ID,
  title: "Q1 restoration impact",
  description: "Contextual diagnosis",
  diagnosis:
    "Degraded pasture with <1% soil organic matter; fragmented native species corridors limit pollinator movement.",
  smartOutcomes: [
    { description: "Plant native seedlings", metric: "treesPlanted", target: 200 },
    { description: "Restore contiguous corridor", metric: "areaCoveredHa", target: 5 },
  ],
  cynefinPhase: CynefinPhase.COMPLEX,
  domain: Domain.AGRO,
  selectedActionUIDs: [],
  reportingPeriod: { start: 1_704_067_200, end: 1_711_843_200 },
  sdgTargets: [13, 15],
  attachments: [],
  location: "Alto Paraíso, Goiás",
  createdAt: 1_711_843_200,
};

const meta: Meta<typeof HypercertPreview> = {
  title: "Admin/Workflows/Hypercerts/Steps/HypercertPreview",
  component: HypercertPreview,
  tags: ["autodocs"],
  decorators: [withRouter(["/garden"])],
  parameters: {
    docs: {
      description: {
        component:
          "Hypercert wizard step 4. Preview of the eventual minted hypercert: image, metadata, allowlist distribution, and optional linked assessment summary.",
      },
    },
  },
  args: {
    gardenName: "Rio Rainforest Lab",
    gardenId: GARDEN_ID,
    totalUnits: TOTAL_UNITS,
    onEditMetadata: fn(),
    onEditDistribution: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof HypercertPreview>;

export const WithMetadata: Story = {
  args: {
    metadata: METADATA,
    attestationCount: 12,
    allowlist: ALLOWLIST,
  },
};

export const WithLinkedAssessment: Story = {
  args: {
    metadata: METADATA,
    attestationCount: 12,
    allowlist: ALLOWLIST,
    selectedAssessment: ASSESSMENT,
  },
};

export const NoMetadata: Story = {
  args: {
    metadata: null,
    attestationCount: 0,
  },
};

export const NoAllowlist: Story = {
  args: {
    metadata: METADATA,
    attestationCount: 3,
    allowlist: [],
  },
};
