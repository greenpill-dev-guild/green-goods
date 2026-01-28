import type { Meta, StoryObj } from "@storybook/react";
import { GardenCard, type GardenCardData } from "./GardenCard";

const mockGarden: GardenCardData = {
  id: "garden-1",
  name: "Community Permaculture Garden",
  location: "Portland, OR",
  description:
    "A community-driven permaculture space focused on native plants and sustainable growing practices.",
  bannerImage: "https://picsum.photos/800/400?random=1",
  gardeners: ["0x1234...5678", "0x2345...6789", "0x3456...7890"],
  operators: ["0xabcd...efgh"],
};

const meta: Meta<typeof GardenCard> = {
  title: "Components/Cards/GardenCard",
  component: GardenCard,
  tags: ["autodocs"],
  argTypes: {
    media: {
      control: "select",
      options: ["large", "small"],
      description: "Media size variant",
    },
    height: {
      control: "select",
      options: ["home", "selection", "default"],
      description: "Card height variant",
    },
    interactive: {
      control: "boolean",
      description: "Whether card is clickable",
    },
    selected: {
      control: "boolean",
      description: "Selection state",
    },
    showOperators: {
      control: "boolean",
      description: "Show operators section",
    },
    showDescription: {
      control: "boolean",
      description: "Show description",
    },
    showBanner: {
      control: "boolean",
      description: "Show banner image",
    },
  },
};

export default meta;
type Story = StoryObj<typeof GardenCard>;

export const Default: Story = {
  args: {
    garden: mockGarden,
  },
};

export const Selected: Story = {
  args: {
    garden: mockGarden,
    selected: true,
  },
};

export const WithOperators: Story = {
  args: {
    garden: mockGarden,
    showOperators: true,
  },
};

export const WithDescription: Story = {
  args: {
    garden: mockGarden,
    showDescription: true,
  },
};

export const NoBanner: Story = {
  args: {
    garden: {
      ...mockGarden,
      bannerImage: undefined,
    },
  },
};

export const SelectionHeight: Story = {
  args: {
    garden: mockGarden,
    height: "selection",
  },
};

export const SmallMedia: Story = {
  args: {
    garden: mockGarden,
    media: "small",
  },
};

export const NonInteractive: Story = {
  args: {
    garden: mockGarden,
    interactive: false,
  },
};

export const CardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <GardenCard garden={mockGarden} />
      <GardenCard
        garden={{
          ...mockGarden,
          id: "garden-2",
          name: "Urban Food Forest",
          location: "Seattle, WA",
          bannerImage: "https://picsum.photos/800/400?random=2",
        }}
      />
      <GardenCard
        garden={{
          ...mockGarden,
          id: "garden-3",
          name: "Rooftop Vegetables",
          location: "San Francisco, CA",
          bannerImage: undefined,
        }}
      />
      <GardenCard
        garden={{
          ...mockGarden,
          id: "garden-4",
          name: "Medicinal Herbs Garden",
          location: "Denver, CO",
          bannerImage: "https://picsum.photos/800/400?random=4",
        }}
        selected
      />
    </div>
  ),
};

export const SelectionList: Story = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-md">
      <GardenCard garden={mockGarden} height="selection" />
      <GardenCard
        garden={{
          ...mockGarden,
          id: "garden-2",
          name: "Urban Food Forest",
        }}
        height="selection"
        selected
      />
      <GardenCard
        garden={{
          ...mockGarden,
          id: "garden-3",
          name: "Rooftop Vegetables",
          bannerImage: undefined,
        }}
        height="selection"
      />
    </div>
  ),
};
