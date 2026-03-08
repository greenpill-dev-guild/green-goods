import { type Action, Capital, Domain } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { ActionCard } from "./ActionCard";

const now = Math.floor(Date.now() / 1000);

const mockAction: Action = {
  id: "action-1",
  slug: "plant-native-trees",
  title: "Plant Native Trees",
  description: "Plant indigenous tree species to restore local biodiversity corridors.",
  instructions: "Select a planting site, prepare the soil, and plant seedlings at 3m spacing.",
  startTime: now - 86400,
  endTime: now + 86400 * 30,
  capitals: [Capital.LIVING, Capital.SOCIAL],
  media: ["/placeholder-tree.jpg"],
  domain: Domain.AGRO,
  createdAt: now - 86400 * 7,
  inputs: [],
  mediaInfo: {
    title: "Photo Evidence",
    description: "Take photos of the planted trees, including the root ball and surrounding area.",
    maxImageCount: 5,
    required: true,
    minImageCount: 1,
    needed: ["Wide shot of planting site", "Close-up of seedling"],
  },
};

const mockActionNoImage: Action = {
  ...mockAction,
  id: "action-2",
  slug: "soil-sampling",
  title: "Soil Sampling",
  description: "Collect soil samples for nutrient analysis to guide regenerative practices.",
  media: [],
  mediaInfo: {
    title: "Sample Photos",
    description: "Photograph each sample bag with its label visible.",
  },
};

const mockActionLong: Action = {
  ...mockAction,
  id: "action-3",
  slug: "community-composting-workshop",
  title: "Community Composting & Vermiculture Workshop Series",
  description:
    "A multi-week educational series covering aerobic composting, vermicomposting, bokashi fermentation, and how to integrate these systems into home gardens for nutrient cycling.",
  mediaInfo: {
    title: "Workshop Documentation",
    description:
      "Document each session with photos of participants, compost bins, and the finished compost product quality.",
  },
};

const meta: Meta<typeof ActionCard> = {
  title: "Client/Cards/ActionCard",
  component: ActionCard,
  tags: ["autodocs"],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  argTypes: {
    action: {
      control: "object",
      description: "Action domain object with title, media, and configuration",
    },
    selected: {
      control: "boolean",
      description: "Whether the card is currently selected (highlights border and title)",
    },
    media: {
      control: "select",
      options: ["large", "small"],
      description: "Image size variant. 'large' shows a taller hero image.",
    },
    height: {
      control: "select",
      options: ["home", "selection", "default"],
      description: "Height variant for different layout contexts",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ActionCard>;

export const Default: Story = {
  args: {
    action: mockAction,
    selected: false,
    media: "large",
    height: "default",
  },
};

export const Selected: Story = {
  args: {
    action: mockAction,
    selected: true,
    media: "large",
    height: "default",
  },
};

export const SmallMedia: Story = {
  args: {
    action: mockAction,
    selected: false,
    media: "small",
    height: "default",
  },
};

export const SelectionHeight: Story = {
  args: {
    action: mockAction,
    selected: false,
    media: "small",
    height: "selection",
  },
};

export const NoImage: Story = {
  args: {
    action: mockActionNoImage,
    selected: false,
    media: "large",
  },
};

export const LongTitle: Story = {
  args: {
    action: mockActionLong,
    selected: false,
    media: "large",
  },
};

export const DarkMode: Story = {
  args: {
    action: mockAction,
    selected: false,
    media: "large",
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-sm">
      <p className="text-xs text-text-sub-600 font-medium">Default (large media)</p>
      <ActionCard action={mockAction} selected={false} media="large" />

      <p className="text-xs text-text-sub-600 font-medium">Selected</p>
      <ActionCard action={mockAction} selected={true} media="large" />

      <p className="text-xs text-text-sub-600 font-medium">Small media</p>
      <ActionCard action={mockAction} selected={false} media="small" />

      <p className="text-xs text-text-sub-600 font-medium">No image (fallback)</p>
      <ActionCard action={mockActionNoImage} selected={false} media="large" />

      <p className="text-xs text-text-sub-600 font-medium">Long title (truncation)</p>
      <ActionCard action={mockActionLong} selected={true} media="large" />
    </div>
  ),
};

export const Mobile: Story = {
  args: {
    action: mockAction,
    selected: false,
    media: "large",
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
