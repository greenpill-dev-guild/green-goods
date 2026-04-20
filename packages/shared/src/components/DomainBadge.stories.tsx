import type { Meta, StoryObj } from "@storybook/react";
import { Domain } from "../types/domain";
import { DomainBadge } from "./DomainBadge";

const meta: Meta<typeof DomainBadge> = {
  title: "Shared/DomainBadge",
  component: DomainBadge,
  tags: ["autodocs"],
  args: {
    domain: Domain.AGRO,
    size: "sm",
  },
  argTypes: {
    domain: {
      control: "select",
      options: [Domain.SOLAR, Domain.AGRO, Domain.EDU, Domain.WASTE],
      mapping: {
        [Domain.SOLAR]: Domain.SOLAR,
        [Domain.AGRO]: Domain.AGRO,
        [Domain.EDU]: Domain.EDU,
        [Domain.WASTE]: Domain.WASTE,
      },
      labels: {
        [Domain.SOLAR]: "Solar",
        [Domain.AGRO]: "Agro",
        [Domain.EDU]: "Education",
        [Domain.WASTE]: "Waste",
      },
    },
    size: {
      control: "inline-radio",
      options: ["sm", "md"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof DomainBadge>;

export const Default: Story = {};

export const Medium: Story = {
  args: {
    size: "md",
  },
};

export const AllDomains: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {[Domain.SOLAR, Domain.AGRO, Domain.EDU, Domain.WASTE].map((domain) => (
        <DomainBadge key={domain} {...args} domain={domain} />
      ))}
    </div>
  ),
};
