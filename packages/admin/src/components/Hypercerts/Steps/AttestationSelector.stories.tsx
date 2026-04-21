import {
  type Address,
  CynefinPhase,
  Domain,
  type GardenAssessment,
  type HypercertAttestation,
} from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { daysAgo } from "../../../../../shared/.storybook/fixtures";
import { AttestationSelector } from "./AttestationSelector";

function attestation(
  id: string,
  title: string,
  domain: string,
  approvedAt: number,
  gardenerName?: string
): HypercertAttestation {
  return {
    id,
    workUid: `${id}-work`,
    gardenId: "0x1234567890123456789012345678901234567890",
    title,
    domain: domain as unknown as HypercertAttestation["domain"],
    actionType: undefined,
    workScope: ["agroforestry"],
    gardenerAddress: "0x1111111111111111111111111111111111111111" as Address,
    gardenerName: gardenerName ?? null,
    mediaUrls: [],
    createdAt: approvedAt - 86_400,
    approvedAt,
  };
}

const ATTESTATIONS: HypercertAttestation[] = [
  attestation("0xatt1", "Planted 50 saplings", "agroforestry", daysAgo(2), "maria.eth"),
  attestation("0xatt2", "Cleared 40kg debris", "waste", daysAgo(4), "juan.eth"),
  attestation("0xatt3", "Workshop cohort 12", "education", daysAgo(6), "ana.eth"),
  attestation("0xatt4", "Panel install site 3", "solar", daysAgo(9), "diego.eth"),
];

const ASSESSMENT: GardenAssessment = {
  id: "0xassess1",
  schemaVersion: "assessment_v2",
  authorAddress: "0x1111111111111111111111111111111111111111" as Address,
  gardenAddress: "0x1234567890123456789012345678901234567890" as Address,
  title: "Q1 restoration impact",
  description: "",
  diagnosis: "",
  smartOutcomes: [],
  cynefinPhase: CynefinPhase.COMPLEX,
  domain: Domain.AGRO,
  selectedActionUIDs: [],
  reportingPeriod: { start: NOW - 90 * 86_400, end: NOW },
  sdgTargets: [],
  attachments: [],
  location: "",
  createdAt: NOW - 2 * 86_400,
};

const meta: Meta<typeof AttestationSelector> = {
  title: "Admin/Workflows/Hypercerts/Steps/AttestationSelector",
  component: AttestationSelector,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Hypercert wizard step 1. Search + domain filter + optional assessment filter. Selected attestations propagate through the wizard; bundled attestations are disabled.",
      },
    },
  },
  args: {
    onToggle: fn(),
    onSelectAll: fn(),
    onDeselectAll: fn(),
    onAssessmentChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof AttestationSelector>;

export const WithData: Story = {
  args: {
    attestations: ATTESTATIONS,
    selectedIds: [],
    isLoading: false,
    hasError: false,
  },
};

export const Loading: Story = {
  args: {
    attestations: [],
    selectedIds: [],
    isLoading: true,
    hasError: false,
  },
};

export const Empty: Story = {
  args: {
    attestations: [],
    selectedIds: [],
    isLoading: false,
    hasError: false,
  },
};

export const Error: Story = {
  args: {
    attestations: [],
    selectedIds: [],
    isLoading: false,
    hasError: true,
  },
};

export const WithSelection: Story = {
  args: {
    attestations: ATTESTATIONS,
    selectedIds: ["0xatt1", "0xatt2"],
    isLoading: false,
    hasError: false,
  },
};

export const WithBundled: Story = {
  args: {
    attestations: ATTESTATIONS,
    selectedIds: ["0xatt1"],
    isLoading: false,
    hasError: false,
    bundledInfo: {
      "0xatt3": { hypercertId: "42", title: "Education Q4 bundle" },
    },
  },
};

export const WithAssessmentFilter: Story = {
  args: {
    attestations: ATTESTATIONS,
    selectedIds: [],
    isLoading: false,
    hasError: false,
    assessments: [ASSESSMENT],
    selectedAssessmentId: null,
  },
};
