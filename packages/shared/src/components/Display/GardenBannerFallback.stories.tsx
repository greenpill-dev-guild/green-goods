import type { Meta, StoryObj } from "@storybook/react";
import { GardenBannerFallback } from "./GardenBannerFallback";

const meta: Meta<typeof GardenBannerFallback> = {
  title: "Media/GardenBannerFallback",
  component: GardenBannerFallback,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="relative w-64 h-40 rounded-lg overflow-hidden">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    name: {
      control: "text",
      description: "Garden name — used for deterministic gradient selection",
    },
    className: {
      control: "text",
      description: "Additional class names for the root container",
    },
  },
};

export default meta;
type Story = StoryObj<typeof GardenBannerFallback>;

export const Default: Story = {
  args: {
    name: "Greenpill Bogota",
  },
};

export const DarkMode: Story = {
  args: {
    name: "Greenpill Bogota",
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <div className="relative w-64 h-40 rounded-lg overflow-hidden">
          <Story />
        </div>
      </div>
    ),
  ],
};

export const Gallery: Story = {
  decorators: [],
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      {[
        "Greenpill Bogota",
        "Regen Melbourne",
        "Solarpunk Tokyo",
        "Green Berlin",
        "EcoDAO Lagos",
        "Mycelium Network",
        "Refi Nairobi",
        "GreenPill NYC",
      ].map((name) => (
        <div key={name} className="flex flex-col gap-1">
          <div className="relative w-full h-32 rounded-lg overflow-hidden">
            <GardenBannerFallback name={name} />
          </div>
          <span className="text-xs text-text-secondary">{name}</span>
        </div>
      ))}
    </div>
  ),
};
