import type { PublicImpactEvidenceRecord } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { PublicEvidenceLedgerRow } from "./PublicEvidenceLedgerRow";

const messages = {
  "public.impact.evidence.viewSource": "View source",
  "public.impact.evidence.noSource": "Source pending",
  "public.impact.evidence.thumbnailFallback": "no image",
};

const HUDSON =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80";
const SUSSEX =
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=600&q=80";
const BRAZIL =
  "https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?auto=format&fit=crop&w=600&q=80";

const ASSESSMENT_RECORD: PublicImpactEvidenceRecord = {
  id: "assessment:0xa1",
  kind: "assessment",
  gardenId: "0xgarden1",
  gardenName: "Riverbend Commons",
  title: "Mycorrhizal network restoration plan, year three",
  summary:
    "Soil core sampling, native flora reintroduction, and quarterly evaluator visits across four-acre meadow plots.",
  domain: 1,
  timeWindow: { start: 1_704_067_200, end: 1_725_148_800 },
  easUid: "0xa1",
  sourceAvailable: true,
  createdAt: 1_704_067_200,
};

const WORK_RECORD: PublicImpactEvidenceRecord = {
  id: "work:0xb2",
  kind: "work",
  gardenId: "0xgarden2",
  gardenName: "The Multi-Species Cover Crop Experiment",
  title: "Sown eight species of cover crop across the lower terrace",
  summary: "Photographs from sowing day plus the soil compaction reading at depth 30cm.",
  domain: 1,
  media: [SUSSEX],
  easUid: "0xb2",
  sourceAvailable: true,
  createdAt: 1_711_900_000,
};

const CERTIFICATE_RECORD: PublicImpactEvidenceRecord = {
  id: "certificate:1",
  kind: "certificate",
  gardenId: "0xgarden3",
  gardenName: "Silvopasture, year three",
  title: "Vol. 01 — silvopasture canopy return",
  summary: "Quarterly observations bundled into a public Impact Certificate covering 2024–2025.",
  domain: 1,
  media: [BRAZIL],
  hypercertId: "1",
  sourceAvailable: true,
  createdAt: 1_715_000_000,
};

const PENDING_RECORD: PublicImpactEvidenceRecord = {
  id: "assessment:0xc3",
  kind: "assessment",
  gardenId: "0xgarden4",
  gardenName: "Pending Garden",
  title: "Late-spring Assessment is being prepared",
  domain: 0,
  sourceAvailable: false,
  createdAt: 1_715_500_000,
};

const meta: Meta<typeof PublicEvidenceLedgerRow> = {
  title: "Client/Public/PublicEvidenceLedgerRow",
  component: PublicEvidenceLedgerRow,
  decorators: [
    (Story) => (
      <IntlProvider locale="en" messages={messages}>
        <ul className="mx-auto max-w-3xl bg-bg-weak-50 px-6 py-8 sm:px-10">
          <Story />
        </ul>
      </IntlProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Single row in the Impact ledger. Renders thumbnail + record-kind tag + " +
          "title + summary + meta + source affordance, with hairline rules between rows.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PublicEvidenceLedgerRow>;

export const Assessment: Story = {
  args: {
    record: ASSESSMENT_RECORD,
    gardenImage: HUDSON,
    gardenLocation: "Hudson Valley, NY",
    onOpen: () => undefined,
  },
};

export const Work: Story = {
  args: {
    record: WORK_RECORD,
    gardenLocation: "Sussex, UK",
    onOpen: () => undefined,
  },
};

export const Certificate: Story = {
  args: {
    record: CERTIFICATE_RECORD,
    gardenLocation: "Minas Gerais, BR",
    onOpen: () => undefined,
  },
};

export const SourcePending: Story = {
  args: {
    record: PENDING_RECORD,
    gardenLocation: "—",
    onOpen: () => undefined,
  },
};

export const FullLedger: Story = {
  render: () => (
    <>
      <PublicEvidenceLedgerRow
        record={ASSESSMENT_RECORD}
        gardenImage={HUDSON}
        gardenLocation="Hudson Valley, NY"
        onOpen={() => undefined}
      />
      <PublicEvidenceLedgerRow
        record={WORK_RECORD}
        gardenLocation="Sussex, UK"
        onOpen={() => undefined}
      />
      <PublicEvidenceLedgerRow
        record={CERTIFICATE_RECORD}
        gardenLocation="Minas Gerais, BR"
        onOpen={() => undefined}
      />
      <PublicEvidenceLedgerRow
        record={PENDING_RECORD}
        gardenLocation="—"
        onOpen={() => undefined}
      />
    </>
  ),
};
