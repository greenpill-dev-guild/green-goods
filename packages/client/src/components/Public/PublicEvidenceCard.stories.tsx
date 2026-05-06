import type { PublicImpactEvidenceRecord } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { PublicEvidenceCard } from "./PublicEvidenceCard";

const messages = {
  "public.impact.evidence.thumbnailFallback": "no image",
};

const HUDSON =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80";
const SUSSEX =
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1200&q=80";
const BRAZIL =
  "https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?auto=format&fit=crop&w=1200&q=80";
const TERRACES =
  "https://images.unsplash.com/photo-1542451313-7d8d5b8aac20?auto=format&fit=crop&w=1200&q=80";
const SOIL_CORE =
  "https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&w=1200&q=80";
// Deliberately broken to exercise the per-cell fallback (IPFS gateway exhaustion
// or 404 Hypercert imageUri in the wild).
const BROKEN_IMAGE = "https://example.invalid/not-a-real-image.jpg";

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
  domain: 0,
  media: [BRAZIL],
  hypercertId: "1",
  sourceAvailable: true,
  createdAt: 1_715_000_000,
};

const NO_IMAGE_RECORD: PublicImpactEvidenceRecord = {
  id: "assessment:0xc3",
  kind: "assessment",
  gardenId: "0xgarden4",
  gardenName: "Pending Garden",
  title: "Late-spring Assessment is being prepared",
  domain: 2,
  sourceAvailable: false,
  createdAt: 1_715_500_000,
};

const WORK_TWO_IMAGES_RECORD: PublicImpactEvidenceRecord = {
  ...WORK_RECORD,
  id: "work:0xd4",
  title: "Two-photo set: terrace clearing and rebuilt drystone wall",
  media: [SUSSEX, TERRACES],
  easUid: "0xd4",
  createdAt: 1_712_000_000,
};

const WORK_THREE_IMAGES_RECORD: PublicImpactEvidenceRecord = {
  ...WORK_RECORD,
  id: "work:0xe5",
  title: "Sequence: planting, mulching, soil core sampling",
  media: [SUSSEX, TERRACES, SOIL_CORE],
  easUid: "0xe5",
  createdAt: 1_712_100_000,
};

const CERTIFICATE_BROKEN_RECORD: PublicImpactEvidenceRecord = {
  ...CERTIFICATE_RECORD,
  id: "certificate:broken",
  title: "Taiwan canopy restoration · Vol. 02",
  gardenName: "Taipei East Mountain Cooperative",
  media: [BROKEN_IMAGE],
  hypercertId: "broken",
  createdAt: 1_716_000_000,
};

const WORK_PARTIAL_BROKEN_RECORD: PublicImpactEvidenceRecord = {
  ...WORK_RECORD,
  id: "work:0xf6",
  title: "Three-shot set with one image that didn't load",
  media: [SUSSEX, BROKEN_IMAGE, SOIL_CORE],
  easUid: "0xf6",
  createdAt: 1_716_500_000,
};

const meta: Meta<typeof PublicEvidenceCard> = {
  title: "Client/Public/PublicEvidenceCard",
  component: PublicEvidenceCard,
  decorators: [
    (Story) => (
      <IntlProvider locale="en" messages={messages}>
        <div className="mx-auto max-w-md bg-editorial-warm px-6 py-10 sm:px-10">
          <Story />
        </div>
      </IntlProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Image-forward editorial card for the Impact evidence grid. " +
          "Mirrors the PublicGardenCard vocabulary — aspect-3/2 photo, " +
          "no chrome — and opens the source dialog on click.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PublicEvidenceCard>;

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

export const NoImage: Story = {
  args: {
    record: NO_IMAGE_RECORD,
    gardenLocation: "—",
    onOpen: () => undefined,
  },
};

export const WorkTwoImages: Story = {
  args: {
    record: WORK_TWO_IMAGES_RECORD,
    gardenLocation: "Sussex, UK",
    onOpen: () => undefined,
  },
};

export const WorkThreeImages: Story = {
  args: {
    record: WORK_THREE_IMAGES_RECORD,
    gardenLocation: "Sussex, UK",
    onOpen: () => undefined,
  },
};

export const CertificateBrokenImage: Story = {
  args: {
    record: CERTIFICATE_BROKEN_RECORD,
    gardenLocation: "Taipei, TW",
    onOpen: () => undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Hypercert with a Taiwan-style imageUri that 404s. With no working " +
          "images left, the whole image area becomes a distinct placeholder " +
          "tile (named by kind) — distinguished from the page background so " +
          "it reads as a deliberate 'image unavailable' label, not a hole.",
      },
    },
  },
};

export const WorkPartialBroken: Story = {
  args: {
    record: WORK_PARTIAL_BROKEN_RECORD,
    gardenLocation: "Sussex, UK",
    onOpen: () => undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Three-image mosaic where the middle image fails. The failed URL is " +
          "removed from the rendered set, so the layout reflows down to the " +
          "two-image vertical split — the visitor never sees a cell-shaped " +
          "hole next to working photos.",
      },
    },
  },
};

export const FullGrid: Story = {
  decorators: [
    (Story) => (
      <IntlProvider locale="en" messages={messages}>
        <div className="bg-editorial-warm px-6 py-12 sm:px-10 md:py-20">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
            <Story />
          </div>
        </div>
      </IntlProvider>
    ),
  ],
  render: () => (
    <>
      <PublicEvidenceCard
        record={ASSESSMENT_RECORD}
        gardenImage={HUDSON}
        gardenLocation="Hudson Valley, NY"
        onOpen={() => undefined}
      />
      <PublicEvidenceCard
        record={WORK_RECORD}
        gardenLocation="Sussex, UK"
        onOpen={() => undefined}
      />
      <PublicEvidenceCard
        record={CERTIFICATE_RECORD}
        gardenLocation="Minas Gerais, BR"
        onOpen={() => undefined}
      />
      <PublicEvidenceCard record={NO_IMAGE_RECORD} gardenLocation="—" onOpen={() => undefined} />
    </>
  ),
};
