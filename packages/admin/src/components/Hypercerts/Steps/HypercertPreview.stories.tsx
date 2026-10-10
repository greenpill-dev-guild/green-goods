import { TOTAL_UNITS } from "@green-goods/shared/lib/hypercerts/constants";
import {
  type Address,
  CynefinPhase,
  Domain,
  type GardenAssessment,
} from "@green-goods/shared/types/domain";
import {
  isHypercertMintingInProgress,
  type MintingState,
} from "@green-goods/shared/stores/useHypercertWizardStore";
import type { AllowlistEntry, HypercertMetadata } from "@green-goods/shared/types/hypercerts";
import type { Meta, StoryObj } from "@storybook/react";
import { useIntl } from "react-intl";
import { fn } from "storybook/test";
import { withRouter } from "../../../../../shared/.storybook/decorators";
import { FIXTURE_IMAGE_AGROFORESTRY } from "../../../../../shared/.storybook/fixtures";
import { ADMIN_FLOW_DIALOG_CLASS, AdminDialog } from "../../AdminDialog";
import { ActionFlowShell } from "../../Layout/ActionFlowShell";
import { FlowSendFooter, flowSendPhase } from "../../Layout/FlowSendFooter";
import { FlowStatusRow } from "../../Layout/FlowStatusRow";
import { FlowStepHeader } from "../../Layout/FlowStepHeader";
import { hypercertSendStatus } from "../HypercertWizard/reviewStatus";
import { HypercertPreview } from "./HypercertPreview";

const GARDEN_ID = "0x1234567890123456789012345678901234567890" as Address;

const METADATA: HypercertMetadata = {
  name: "Q1 Restoration Impact",
  description:
    "Bundled attestations from the March planting cohort and aggregated survival checks.",
  image: FIXTURE_IMAGE_AGROFORESTRY,
  hypercert: {
    work_scope: { name: "Work Scope", value: ["planting", "survival-check"], excludes: [] },
    impact_scope: {
      name: "Impact Scope",
      value: ["carbon-sequestration", "biodiversity"],
      excludes: [],
    },
    work_timeframe: {
      name: "Work Timeframe",
      value: [1_704_067_200, 1_711_843_200],
      display_value: "Jan 2026 – Mar 2026",
    },
    impact_timeframe: {
      name: "Impact Timeframe",
      value: [1_704_067_200, 0],
      display_value: "",
    },
    contributors: {
      name: "Contributors",
      value: ["0x1111…", "0x2222…"],
      excludes: [],
    },
    rights: { name: "Rights", value: ["Public Display", "Transfer"], excludes: [] },
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
    label: "Steward",
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

const noop = () => undefined;

const STEPS = [
  { id: "attestations", title: "Select Work" },
  { id: "metadata", title: "Metadata" },
  { id: "distribution", title: "Distribution" },
  { id: "preview", title: "Review" },
];

/**
 * The Review where a steward meets it: the last step of the Create Hypercert
 * dialog, with the mint at one stage in its status row (DL-080).
 */
function ReviewInFlow({ stage }: { stage: MintingState["status"] }) {
  const { formatMessage } = useIntl();
  const phase = flowSendPhase({
    sending: isHypercertMintingInProgress(stage),
    sent: stage === "confirmed",
    failed: stage === "failed",
  });
  const status = hypercertSendStatus({
    phase,
    stage,
    failure: {
      tone: "warning",
      title: "Transaction cancelled",
      description: "Transaction was cancelled. Please try again when ready.",
    },
    formatMessage,
  });
  const editable = phase === "ready" || phase === "failed";
  return (
    <AdminDialog
      open
      size="lg"
      variant="flow"
      tone="hub"
      className={ADMIN_FLOW_DIALOG_CLASS}
      onOpenChange={noop}
      preventClose={phase === "sending"}
      title="Create Hypercert"
      description="Bundle approved work from Rio Rainforest Lab into a hypercert."
      bodyClassName="flex min-h-0 flex-col !overflow-hidden"
    >
      <ActionFlowShell
        layout="dialog"
        title="Create Hypercert"
        context="Rio Rainforest Lab"
        steps={STEPS}
        currentStep={STEPS.length}
        complete={phase === "sent"}
        footer={
          <FlowSendFooter
            stepIndex={STEPS.length - 1}
            isLast
            phase={phase}
            sendLabel="Mint Hypercert"
            note={
              phase === "sending" ? "The dialog stays open until your wallet answers." : undefined
            }
            onCancel={noop}
            onBack={noop}
            onNext={noop}
            onSend={noop}
            onDone={noop}
          />
        }
      >
        <div className="space-y-4">
          <FlowStepHeader title="Review" description="Check everything before minting" />
          <FlowStatusRow
            tone={status.tone}
            busy={status.busy}
            title={status.title}
            description={status.description}
          />
          <HypercertPreview
            metadata={METADATA}
            gardenName="Rio Rainforest Lab"
            gardenId={GARDEN_ID}
            attestationCount={12}
            totalUnits={TOTAL_UNITS}
            allowlist={ALLOWLIST}
            mintingState={{
              status: stage,
              metadataCid: null,
              allowlistCid: null,
              merkleRoot: null,
              userOpHash: null,
              txHash: null,
              hypercertId: null,
              error: null,
              poolRegistered: null,
              signalPoolAddress: null,
            }}
            onEditMetadata={editable ? noop : undefined}
            onEditDistribution={editable ? noop : undefined}
          />
        </div>
      </ActionFlowShell>
    </AdminDialog>
  );
}

// The Review inside the Create Hypercert dialog at each moment of the mint,
// footer included. They stay out of the docs page, which would open several
// modal dialogs at once.
const inFlow = (stage: MintingState["status"]): Story => ({
  render: () => <ReviewInFlow stage={stage} />,
  tags: ["!autodocs"],
});

export const InFlowReady: Story = inFlow("idle");

export const InFlowSending: Story = inFlow("awaiting_signature");

export const InFlowSent: Story = inFlow("confirmed");

export const InFlowFailed: Story = inFlow("failed");
