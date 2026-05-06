import type { PublicGardenSummary, PublicImpactEvidenceRecord } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { PublicEvidenceDialog } from "./PublicEvidenceDialog";

const messages: Record<string, string> = {
  "public.source.close": "Close",
  "public.impact.dialog.cite": "Cite this record",
  "public.impact.dialog.close": "Close · Esc",
  "public.impact.dialog.meta.garden": "Garden",
  "public.impact.dialog.meta.location": "Location",
  "public.impact.dialog.meta.stage": "Pipeline stage",
  "public.impact.dialog.meta.timeWindow": "Time window",
  "public.impact.dialog.openSource": "Open ↗",
  "public.impact.dialog.pending": "Pending",
  "public.impact.dialog.recordHeader": "Evidence record · № {id}",
  "public.impact.dialog.refs.awaiting": "Awaiting evaluator",
  "public.impact.dialog.refs.certificate": "Impact Certificate",
  "public.impact.dialog.sourceRecords": "Source records",
  "public.impact.evidence.viewSource": "View source",
  "public.impact.evidence.noSource": "Source pending",
};

const RIVERBEND: PublicGardenSummary = {
  id: "0x1111",
  address: "0x1111",
  name: "Riverbend Commons",
  slug: "riverbend-commons",
  location: "Hudson Valley, NY",
  bannerImage: "",
  description: "",
} as unknown as PublicGardenSummary;

const ASSESSMENT_RECORD: PublicImpactEvidenceRecord = {
  id: "assessment:0xabcdef0123456789abcdef0123456789abcdef0123",
  kind: "assessment",
  gardenId: "0x1111",
  gardenName: "Riverbend Commons",
  title: "Soil core series — meadow plot E, spring re-survey",
  summary:
    "Twelve cores taken on a 14-day rotation across plot E. Bulk density and root depth photographed beside reference cards; submitted alongside a written transect note.",
  domain: 1,
  timeWindow: { start: 1_741_046_400, end: 1_742_256_000 },
  media: [
    "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1532153975070-2e9ab71f1b14?auto=format&fit=crop&w=1200&q=80",
  ],
  easUid: "0xabcdef0123456789abcdef0123456789abcdef0123",
  sourceAvailable: true,
  createdAt: 1_742_256_000,
};

const PENDING_RECORD: PublicImpactEvidenceRecord = {
  id: "work:0x9876543210fedcba9876543210fedcba98765432",
  kind: "work",
  gardenId: "0x2222",
  gardenName: "Old Mill Field",
  title: "Cover crop trial — eight-species mix, field B",
  summary:
    "Sown October '25, observed monthly through winter. Compaction probe readings, photo transect, and a hand-drawn sketch of root biomass at month four.",
  domain: 1,
  timeWindow: { start: 1_697_500_800, end: null },
  sourceAvailable: false,
  createdAt: 1_697_500_800,
};

const CERTIFICATE_RECORD: PublicImpactEvidenceRecord = {
  id: "certificate:340282366920938463463374607431768211457",
  kind: "certificate",
  gardenId: "0x3333",
  gardenName: "Plataforma Verde",
  title: "Solar array, classroom annex — commissioning record",
  summary:
    "A 6.4 kWp rooftop array installed by the schoolhouse cooperative. Wiring schedule and inverter readings logged daily for the first eight weeks of operation.",
  domain: 0,
  timeWindow: { start: 1_706_745_600, end: 1_711_756_800 },
  hypercertId: "0x1234567890abcdef-1234567890abcdef-1",
  sourceAvailable: true,
  createdAt: 1_711_756_800,
};

const meta: Meta<typeof PublicEvidenceDialog> = {
  title: "Public/PublicEvidenceDialog",
  component: PublicEvidenceDialog,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <IntlProvider locale="en" messages={messages}>
        <div className="min-h-screen bg-editorial-warm">
          <Story />
        </div>
      </IntlProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof PublicEvidenceDialog>;

export const Assessment: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    record: ASSESSMENT_RECORD,
    garden: RIVERBEND,
  },
};

export const SourcePending: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    record: PENDING_RECORD,
  },
};

export const Certificate: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    record: CERTIFICATE_RECORD,
  },
};
