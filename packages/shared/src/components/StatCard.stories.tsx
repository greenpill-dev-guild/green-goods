import type { Meta, StoryObj } from "@storybook/react";
import {
  RiCheckboxCircleLine,
  RiCoinsLine,
  RiLeafLine,
  RiSeedlingLine,
  RiTeamLine,
} from "@remixicon/react";
import { MemoryRouter } from "react-router-dom";
import { StatCard } from "./StatCard";

const trendPill = (
  <span className="inline-flex items-center rounded-full bg-success-lighter px-2 py-1 text-xs font-medium text-success-dark">
    +18% this month
  </span>
);

const meta: Meta<typeof StatCard> = {
  title: "Admin/UI/StatCard",
  component: StatCard,
  tags: ["autodocs"],
  argTypes: {
    label: {
      control: "text",
      description: "Short metric label shown above the value.",
    },
    value: {
      control: "text",
      description: "Primary metric value.",
    },
    titleText: {
      control: "text",
      description: "Optional title attribute for truncated values.",
    },
    colorScheme: {
      control: "select",
      options: ["success", "warning", "error", "info"],
      description: "Visual accent treatment for the icon chip.",
    },
    hero: {
      control: "boolean",
      description: "Use the larger hero presentation.",
    },
    trend: {
      control: false,
      description: "Optional supporting trend element rendered under the value.",
    },
    to: {
      control: "text",
      description: "Optional route target that turns the card into a Link.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: <RiSeedlingLine className="h-5 w-5" />,
    label: "Active gardens",
    value: "12",
    colorScheme: "success",
  },
};

export const HeroMetric: Story = {
  args: {
    icon: <RiCoinsLine className="h-5 w-5" />,
    label: "Treasury balance",
    value: "$128,420",
    titleText: "$128,420.55",
    colorScheme: "info",
    hero: true,
    trend: trendPill,
  },
};

export const WarningState: Story = {
  args: {
    icon: <RiLeafLine className="h-5 w-5" />,
    label: "Pending reviews",
    value: "7",
    colorScheme: "warning",
  },
};

export const LinkedCard: Story = {
  render: (args) => (
    <MemoryRouter>
      <div className="max-w-sm">
        <StatCard {...args} />
      </div>
    </MemoryRouter>
  ),
  args: {
    icon: <RiTeamLine className="h-5 w-5" />,
    label: "Community members",
    value: "248",
    colorScheme: "success",
    to: "/community?card=members",
  },
};

export const Gallery: Story = {
  args: {
    icon: <RiSeedlingLine className="h-5 w-5" />,
    label: "Active gardens",
    value: "12",
    colorScheme: "success",
  },
  render: () => (
    <MemoryRouter>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={<RiSeedlingLine className="h-5 w-5" />}
          label="Active gardens"
          value="12"
          colorScheme="success"
        />
        <StatCard
          icon={<RiCheckboxCircleLine className="h-5 w-5" />}
          label="Approved actions"
          value="39"
          colorScheme="info"
        />
        <StatCard
          icon={<RiCoinsLine className="h-5 w-5" />}
          label="Treasury balance"
          value="$128,420"
          colorScheme="info"
          hero
          trend={trendPill}
        />
        <StatCard
          icon={<RiTeamLine className="h-5 w-5" />}
          label="Community members"
          value="248"
          colorScheme="success"
          to="/community?card=members"
        />
      </div>
    </MemoryRouter>
  ),
};

export const DarkMode: Story = {
  args: {
    icon: <RiLeafLine className="h-5 w-5" />,
    label: "Needs attention",
    value: "3",
    colorScheme: "error",
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
