import {
  type Address,
  CynefinPhase,
  Domain,
  type GardenAssessment,
  type HypercertDraft,
} from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MetadataEditor } from "./MetadataEditor";

const EMPTY_DRAFT: HypercertDraft = {
  id: "draft-1",
  gardenId: "0x1234567890123456789012345678901234567890",
  operatorAddress: "0x1111111111111111111111111111111111111111" as Address,
  stepNumber: 2,
  attestationIds: [],
  title: "",
  description: "",
  workScopes: [],
  impactScopes: [],
  workTimeframeStart: 0,
  workTimeframeEnd: 0,
  impactTimeframeStart: 0,
  impactTimeframeEnd: null,
  sdgs: [],
  capitals: [],
  outcomes: {},
  allowlist: [],
  externalUrl: "",
  createdAt: 0,
  updatedAt: 0,
};

const PREFILLED_DRAFT: HypercertDraft = {
  ...EMPTY_DRAFT,
  title: "Q1 Restoration Impact",
  description:
    "Bundled attestations from the March planting cohort with aggregated survival checks.",
  workScopes: ["planting", "survival-check"],
  impactScopes: ["carbon-sequestration", "biodiversity"],
  workTimeframeStart: 1_704_067_200,
  workTimeframeEnd: 1_711_843_200,
  sdgs: [13, 15],
  capitals: ["living", "social"],
};

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
  reportingPeriod: { start: 1_704_067_200, end: 1_711_843_200 },
  sdgTargets: [13, 15],
  attachments: [],
  location: "Alto Paraíso, Goiás",
  createdAt: 1_711_843_200,
};

function MetadataEditorHarness({
  initialDraft,
  selectedAssessment,
  suggestedScopes = ["planting", "survival-check", "species-inventory"],
  suggestedStart,
  suggestedEnd,
}: {
  initialDraft: HypercertDraft;
  selectedAssessment?: GardenAssessment | null;
  suggestedScopes?: string[];
  suggestedStart?: number | null;
  suggestedEnd?: number | null;
}) {
  const [draft, setDraft] = useState<HypercertDraft>(initialDraft);
  return (
    <MetadataEditor
      draft={draft}
      onUpdate={(updates) => setDraft((d) => ({ ...d, ...updates }))}
      suggestedWorkScopes={suggestedScopes}
      suggestedStart={suggestedStart ?? null}
      suggestedEnd={suggestedEnd ?? null}
      selectedAssessment={selectedAssessment ?? null}
    />
  );
}

const meta: Meta<typeof MetadataEditorHarness> = {
  title: "Admin/Workflows/Hypercerts/Steps/MetadataEditor",
  // storybook-quality-allow state-harness: owns draft state while rendering the real MetadataEditor.
  component: MetadataEditorHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Hypercert wizard step 2. Title/description/scopes, work/impact timeframes, SDG targets, and capitals.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MetadataEditorHarness>;

export const Empty: Story = {
  args: { initialDraft: EMPTY_DRAFT },
};

export const Prefilled: Story = {
  args: { initialDraft: PREFILLED_DRAFT },
};

export const WithSuggestedDates: Story = {
  args: {
    initialDraft: EMPTY_DRAFT,
    suggestedStart: 1_704_067_200,
    suggestedEnd: 1_711_843_200,
  },
};

export const PrefilledFromAssessment: Story = {
  args: {
    initialDraft: PREFILLED_DRAFT,
    selectedAssessment: ASSESSMENT,
  },
};
