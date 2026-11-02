import { useCreateGardenStore } from "@green-goods/shared/stores/useCreateGardenStore";
import { type Address, Domain } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { FIXTURE_IMAGE_BANNER } from "../../../../../shared/.storybook/fixtures";
import { ReviewStep } from "./ReviewStep";

interface Seed {
  name?: string;
  slug?: string;
  description?: string;
  location?: string;
  bannerImage?: string;
  domains?: Domain[];
  openJoining?: boolean;
  gardeners?: Address[];
  stewards?: Address[];
}

function WithStoreState({ seed, children }: { seed: Seed; children: React.ReactNode }) {
  const setField = useCreateGardenStore((s) => s.setField);
  const reset = useCreateGardenStore((s) => s.reset);

  useEffect(() => {
    reset();
    if (seed.name !== undefined) setField("name", seed.name);
    if (seed.slug !== undefined) setField("slug", seed.slug);
    if (seed.description !== undefined) setField("description", seed.description);
    if (seed.location !== undefined) setField("location", seed.location);
    if (seed.bannerImage !== undefined) setField("bannerImage", seed.bannerImage);
    if (seed.domains !== undefined) setField("domains", seed.domains);
    if (seed.openJoining !== undefined) setField("openJoining", seed.openJoining);
    if (seed.gardeners !== undefined) setField("gardeners", seed.gardeners);
    if (seed.stewards !== undefined) setField("stewards", seed.stewards);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per story mount
  }, []);

  return <>{children}</>;
}

const meta: Meta<typeof ReviewStep> = {
  title: "Admin/Workflows/Garden/ReviewStep",
  component: ReviewStep,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Final step of the create-garden wizard. Displays all form values from the Zustand store — no inputs, no validation.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ReviewStep>;

export const MinimalGarden: Story = {
  decorators: [
    (Story) => (
      <WithStoreState
        seed={{
          name: "Atlantic Forest Sprint",
          slug: "atlantic-forest-sprint",
          description: "Short-form restoration sprint focused on native seedlings.",
          location: "Rio de Janeiro, Brazil",
          domains: [Domain.AGRO],
          openJoining: true,
          gardeners: [],
          stewards: [],
        }}
      >
        <Story />
      </WithStoreState>
    ),
  ],
};

export const WithPlannedTeam: Story = {
  decorators: [
    (Story) => (
      <WithStoreState
        seed={{
          name: "Kigali Solar Cooperative",
          slug: "kigali-solar-coop",
          description:
            "Rural hub installations with regular maintenance cycles and community training.",
          location: "Kigali, Rwanda",
          domains: [Domain.SOLAR, Domain.EDU],
          openJoining: false,
          gardeners: [
            "0x1111111111111111111111111111111111111111",
            "0x2222222222222222222222222222222222222222",
          ],
          stewards: ["0x3333333333333333333333333333333333333333"],
        }}
      >
        <Story />
      </WithStoreState>
    ),
  ],
};

export const WithBanner: Story = {
  decorators: [
    (Story) => (
      <WithStoreState
        seed={{
          name: "Riverbank Cleanup Network",
          slug: "riverbank-cleanup",
          description: "Weekly cleanup cycles across the Mithi corridor.",
          location: "Mumbai, India",
          bannerImage: FIXTURE_IMAGE_BANNER,
          domains: [Domain.WASTE],
          openJoining: true,
          gardeners: [],
          stewards: [],
        }}
      >
        <Story />
      </WithStoreState>
    ),
  ],
};

export const Documentation: Story = {
  decorators: [
    (Story) => (
      <WithStoreState
        seed={{
          name: "Riverside Commons Garden",
          slug: "riverside-commons",
          description: "Neighbour-led vegetable beds, rainwater care and practical repair work.",
          location: "Riverside District",
          domains: [Domain.AGRO, Domain.EDU],
          openJoining: false,
          gardeners: [
            "0x1111111111111111111111111111111111111111",
            "0x2222222222222222222222222222222222222222",
          ],
          stewards: ["0x3333333333333333333333333333333333333333"],
        }}
      >
        <Story />
      </WithStoreState>
    ),
  ],
};

/** A creator paying the network fee, with the garden's name paid from the Green Goods name fund. */
export const NameFromTheFund: Story = {
  args: {
    cost: {
      estimate: {
        gasEstimate: 23_868_920n,
        gasPrice: 20_000_000n,
        txFee: 477_378_400_000_000n,
        ccipFee: 0n,
        nameFunding: "reserve",
        totalEstimatedFee: 477_378_400_000_000n,
        formatted: { txFeeEth: "0.000477", ccipFeeEth: "0", totalEth: "0.000477" },
      },
    },
  },
  decorators: [
    (Story) => (
      <WithStoreState
        seed={{
          name: "Harbour Seed Library",
          slug: "harbour-seeds",
          description: "Seed saving and swap days for neighbourhood growers.",
          location: "Lisbon, Portugal",
          domains: [Domain.AGRO],
          openJoining: false,
          gardeners: [],
          stewards: [],
        }}
      >
        <Story />
      </WithStoreState>
    ),
  ],
};
