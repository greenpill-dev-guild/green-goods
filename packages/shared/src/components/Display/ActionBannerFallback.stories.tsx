import type { Meta, StoryObj } from "@storybook/react";
import { Domain } from "../../types/domain";
import { ActionBannerFallback } from "./ActionBannerFallback";

const meta: Meta<typeof ActionBannerFallback> = {
  title: "Media/ActionBannerFallback",
  component: ActionBannerFallback,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="relative w-64 h-40 rounded-lg overflow-hidden">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    domain: {
      control: "select",
      options: [Domain.SOLAR, Domain.AGRO, Domain.EDU, Domain.WASTE],
      description: "Action domain — determines the base color palette",
    },
    title: {
      control: "text",
      description:
        "Action title — used for deterministic gradient variation within the domain",
    },
    className: {
      control: "text",
      description: "Additional class names for the root container",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ActionBannerFallback>;

export const Default: Story = {
  args: {
    domain: Domain.AGRO,
    title: "Plant native trees",
  },
};

export const DarkMode: Story = {
  args: {
    domain: Domain.AGRO,
    title: "Plant native trees",
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
      {(
        [
          { domain: Domain.SOLAR, title: "Install solar panels" },
          { domain: Domain.AGRO, title: "Plant native trees" },
          { domain: Domain.EDU, title: "Host sustainability workshop" },
          { domain: Domain.WASTE, title: "Community cleanup drive" },
          { domain: Domain.SOLAR, title: "Solar water heater" },
          { domain: Domain.AGRO, title: "Harvest rainwater" },
          { domain: Domain.EDU, title: "Biodiversity survey" },
          { domain: Domain.WASTE, title: "Compost setup" },
        ] as const
      ).map(({ domain, title }) => (
        <div key={title} className="flex flex-col gap-1">
          <div className="relative w-full h-32 rounded-lg overflow-hidden">
            <ActionBannerFallback domain={domain} title={title} />
          </div>
          <span className="text-xs text-text-secondary">{title}</span>
        </div>
      ))}
    </div>
  ),
};
