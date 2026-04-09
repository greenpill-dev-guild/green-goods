import { Domain, type Work } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { HubWorkCard } from "./HubWorkCard";

const BASE_WORK: Work = {
  id: "0x123abc",
  title: "Planted 50 native saplings",
  actionUID: 1,
  gardenerAddress: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
  gardenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
  feedback: "Good quality work with clear photos",
  metadata: "{}",
  media: [
    "ipfs://QmExamplePhoto1",
    "ipfs://QmExamplePhoto2",
    "ipfs://QmExamplePhoto3",
  ],
  createdAt: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
  status: "pending",
};

const meta: Meta<typeof HubWorkCard> = {
  title: "Admin/Work/HubWorkCard",
  component: HubWorkCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    actionDomain: {
      control: "select",
      options: [undefined, Domain.SOLAR, Domain.AGRO, Domain.EDU, Domain.WASTE],
      description: "Domain for the badge overlay. Undefined hides the badge.",
    },
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

// Solar domain variant
export const Solar: Story = {
  args: {
    ...Default.args,
    actionDomain: Domain.SOLAR,
    work: { ...BASE_WORK, title: "Installed 2 solar panels" },
    gardenerDisplayName: "ana.eth",
  },
};

// Education domain variant
export const Education: Story = {
  args: {
    ...Default.args,
    actionDomain: Domain.EDU,
    work: { ...BASE_WORK, title: "Composting workshop completed" },
    gardenerDisplayName: "juan.eth",
  },
};

// Waste domain variant
export const Waste: Story = {
  args: {
    ...Default.args,
    actionDomain: Domain.WASTE,
    work: { ...BASE_WORK, title: "Sorted 40kg of recyclables" },
    gardenerDisplayName: "diego.eth",
  },
};

// Single image — spans full width
export const SingleImage: Story = {
  args: {
    ...Default.args,
    work: {
      ...BASE_WORK,
      media: ["ipfs://QmExamplePhoto1"],
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

// Long title — line-clamp-2 truncation
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
