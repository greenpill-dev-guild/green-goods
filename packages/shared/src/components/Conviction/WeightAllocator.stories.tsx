import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { ConvictionAllocations } from "../../types/conviction";
import { WeightAllocator, type WeightAllocatorProposal } from "./WeightAllocator";

const SAMPLE_PROPOSALS: WeightAllocatorProposal[] = [
  { id: "PRP-024", title: "Compost program · Q3 expansion" },
  { id: "PRP-025", title: "Solar microgrid · pilot block" },
  { id: "PRP-027", title: "Greywater filtration units (×3)" },
];

function InteractiveAllocator({
  initial,
  proposals = SAMPLE_PROPOSALS,
}: {
  initial: ConvictionAllocations;
  proposals?: WeightAllocatorProposal[];
}) {
  const [allocations, setAllocations] = useState<ConvictionAllocations>(initial);
  return (
    <WeightAllocator proposals={proposals} allocations={allocations} onChange={setAllocations} />
  );
}

const meta: Meta<typeof WeightAllocator> = {
  title: "Admin/Conviction/WeightAllocator",
  component: WeightAllocator,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Per-member weight allocator. Each row = one active proposal; sliders + numeric input " +
          "stay in sync. Total budget is 100%. Per audit §5.4.1 the allocator lands inline at " +
          "the top of Community → Governance in the first delivery.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof WeightAllocator>;

export const Default: Story = {
  render: () => (
    <InteractiveAllocator
      initial={{
        "PRP-024": 40,
        "PRP-025": 35,
        "PRP-027": 0,
      }}
    />
  ),
};

export const FullyAllocated: Story = {
  render: () => (
    <InteractiveAllocator
      initial={{
        "PRP-024": 50,
        "PRP-025": 30,
        "PRP-027": 20,
      }}
    />
  ),
};

export const OverBudget: Story = {
  name: "Over budget (warning state)",
  render: () => (
    <InteractiveAllocator
      initial={{
        "PRP-024": 60,
        "PRP-025": 50,
        "PRP-027": 10,
      }}
    />
  ),
};

export const Disabled: Story = {
  render: () => (
    <WeightAllocator
      proposals={SAMPLE_PROPOSALS}
      allocations={{ "PRP-024": 40, "PRP-025": 35 }}
      onChange={() => undefined}
      disabled
    />
  ),
};
