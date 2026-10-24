import { Domain, type Work } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import FENCE_AFTER from "../../../../../shared/.storybook/fixture-art/documentation-fence-after.jpg?url";
import FENCE_BEFORE from "../../../../../shared/.storybook/fixture-art/documentation-fence-before.jpg?url";
import SEEDLINGS from "../../../../../shared/.storybook/fixture-art/documentation-seedlings.jpg?url";
import FENCE_LEANING from "../../../../../shared/.storybook/fixture-art/fence-leaning.jpg?url";
import { hoursAgo } from "../../../../../shared/.storybook/fixtures";
import { HubWorkCard } from "./HubWorkCard";

// Real photographs: the card asks the gateway for a sized copy (`?w=…`), which a
// data URL cannot take, so inline fixture images would draw the fallback.
const PHOTOS = [SEEDLINGS, FENCE_BEFORE, FENCE_AFTER, FENCE_LEANING];

const BASE_WORK: Work = {
  id: "0x123abc",
  title: "Planted 50 native saplings",
  actionUID: 1,
  gardenerAddress: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
  gardenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
  feedback: "Good quality work with clear photos",
  metadata: "{}",
  media: PHOTOS.slice(0, 3),
  createdAt: hoursAgo(2),
  status: "pending",
};

const meta: Meta<typeof HubWorkCard> = {
  title: "Admin/Workflows/Hub/HubWorkCard",
  component: HubWorkCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The Hub's work card, the shared media card with the work's photo mosaic. Stacked below the desktop breakpoint; from 1024px the queue lays it wide, the mosaic in a 144px column with the text beside it (F12). Stories focus on the mosaic, domain badge presence, title truncation, and identity fallback states.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  args: { onClick: () => {} },
  argTypes: {
    actionDomain: {
      control: "select",
      options: [undefined, Domain.SOLAR, Domain.AGRO, Domain.EDU, Domain.WASTE],
      description: "Domain for the badge overlay. Undefined hides the badge.",
    },
    layout: { control: "inline-radio", options: ["stacked", "wide"] },
    gardenName: { control: "text" },
    gardenerDisplayName: { control: "text" },
    eagerImages: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof HubWorkCard>;

// Default — 2+ images, Agro domain
export const Default: Story = {
  args: {
    work: BASE_WORK,
    actionDomain: Domain.AGRO,
    gardenName: "Milpa Alta",
    gardenerDisplayName: "maria.eth",
    eagerImages: true,
  },
};

/** The desktop queue's card: the mosaic on the left, the text centered beside it. */
export const Wide: Story = {
  args: { ...Default.args, layout: "wide", actionTitle: "Planting event" },
  decorators: [
    (Story) => (
      <div style={{ width: 580 }}>
        <Story />
      </div>
    ),
  ],
};

/** Every mosaic at both layouts: no photo, one, two, three, and more than three. */
export const MosaicStateCatalog: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 1176 }}>
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <div className="flex flex-col gap-6">
      {(["wide", "stacked"] as const).map((layout) => (
        <ul
          key={layout}
          className="grid list-none gap-3.5 p-0"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${layout === "wide" ? 26 : 18}rem, 1fr))`,
          }}
        >
          {[0, 1, 2, 3, 4].map((photos) => (
            <li key={photos} className="min-w-0">
              <HubWorkCard
                {...args}
                layout={layout}
                work={{
                  ...BASE_WORK,
                  id: `0xmosaic-${layout}-${photos}`,
                  title: `${photos} photo${photos === 1 ? "" : "s"}: planted native saplings`,
                  media: PHOTOS.slice(0, photos),
                }}
                actionDomain={Domain.AGRO}
                actionTitle="Planting event"
                gardenName="Milpa Alta"
                gardenerDisplayName="maria.eth"
                eagerImages
              />
            </li>
          ))}
        </ul>
      ))}
    </div>
  ),
};

export const DomainCatalog: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {[
        {
          domain: Domain.AGRO,
          title: "Planted 50 native saplings",
          gardener: "maria.eth",
        },
        {
          domain: Domain.SOLAR,
          title: "Installed 2 solar panels",
          gardener: "ana.eth",
        },
        {
          domain: Domain.EDU,
          title: "Composting workshop completed",
          gardener: "juan.eth",
        },
        {
          domain: Domain.WASTE,
          title: "Sorted 40kg of recyclables",
          gardener: "diego.eth",
        },
      ].map(({ domain, title, gardener }) => (
        <HubWorkCard
          key={domain}
          work={{ ...BASE_WORK, title }}
          actionDomain={domain}
          gardenName="Milpa Alta"
          gardenerDisplayName={gardener}
          eagerImages
          onClick={() => {}}
        />
      ))}
    </div>
  ),
};

// Single image — spans full width
export const SingleImage: Story = {
  args: {
    ...Default.args,
    work: {
      ...BASE_WORK,
      media: PHOTOS.slice(1, 2),
      title: "Built 3 raised garden beds",
    },
  },
};

// No images — domain gradient fallback
export const NoImages: Story = {
  args: {
    ...Default.args,
    work: {
      ...BASE_WORK,
      media: [],
      title: "Planted herbs in containers",
    },
  },
};

// No domain — badge hidden
export const NoDomain: Story = {
  args: {
    ...Default.args,
    actionDomain: undefined,
  },
};

// Long title — one line, the full title on hover
export const LongTitle: Story = {
  args: {
    ...Default.args,
    work: {
      ...BASE_WORK,
      title:
        "Organized a community-wide composting workshop with hands-on training and distributed starter kits to 25 families",
    },
  },
};

// Truncated address (no ENS)
export const AddressOnly: Story = {
  args: {
    ...Default.args,
    gardenerDisplayName: "0x1a2b...9f8e",
  },
};
