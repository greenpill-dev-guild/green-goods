import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { useCreateGardenStore } from "@green-goods/shared";
import { DetailsStep } from "./DetailsStep";

/**
 * Decorator that pre-populates the Zustand store before the step renders.
 * This avoids needing to mock individual hooks — the real store drives the UI.
 */
function WithStoreState({
  children,
  overrides = {},
}: {
  children: React.ReactNode;
  overrides?: Partial<Record<"name" | "slug" | "description" | "location" | "bannerImage", string>>;
}) {
  const setField = useCreateGardenStore((s) => s.setField);
  const reset = useCreateGardenStore((s) => s.reset);

  useEffect(() => {
    reset();
    for (const [key, value] of Object.entries(overrides)) {
      setField(key as "name" | "slug" | "description" | "location" | "bannerImage", value);
    }
  }, []);

  return <>{children}</>;
}

const meta: Meta<typeof DetailsStep> = {
  title: "Admin/Garden/DetailsStep",
  component: DetailsStep,
  tags: ["autodocs"],
  argTypes: {
    showValidation: {
      control: "boolean",
      description:
        "When true, validation errors are shown immediately for all fields (not just touched ones)",
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl mx-auto">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DetailsStep>;

/**
 * Default empty state with no validation shown.
 * All fields are blank, matching the initial step of the garden creation wizard.
 */
export const Default: Story = {
  args: {
    showValidation: false,
  },
  decorators: [
    (Story) => (
      <WithStoreState>
        <Story />
      </WithStoreState>
    ),
  ],
};

/**
 * All validation errors visible immediately (e.g. user clicked "Next" without filling fields).
 */
export const WithValidationErrors: Story = {
  args: {
    showValidation: true,
  },
  decorators: [
    (Story) => (
      <WithStoreState>
        <Story />
      </WithStoreState>
    ),
  ],
};

/**
 * Pre-filled form showing a realistic garden in progress.
 */
export const Prefilled: Story = {
  args: {
    showValidation: false,
  },
  decorators: [
    (Story) => (
      <WithStoreState
        overrides={{
          name: "Rio Rainforest Lab",
          slug: "rio-rainforest-lab",
          description:
            "A community-driven regenerative effort to document and protect native species in the Atlantic Forest biome near Rio de Janeiro.",
          location: "Rio de Janeiro, Brazil",
        }}
      >
        <Story />
      </WithStoreState>
    ),
  ],
};

/**
 * Partial fill with validation — shows mixed state where some fields pass and others fail.
 */
export const PartialWithValidation: Story = {
  args: {
    showValidation: true,
  },
  decorators: [
    (Story) => (
      <WithStoreState
        overrides={{
          name: "Alpine Meadow",
          slug: "",
          description: "",
          location: "Zurich, Switzerland",
        }}
      >
        <Story />
      </WithStoreState>
    ),
  ],
};

export const DarkMode: Story = {
  args: {
    showValidation: false,
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <WithStoreState
          overrides={{
            name: "Moonlit Garden",
            slug: "moonlit-garden",
            description: "Nighttime biodiversity documentation project.",
            location: "Kyoto, Japan",
          }}
        >
          <div className="max-w-2xl mx-auto">
            <Story />
          </div>
        </WithStoreState>
      </div>
    ),
  ],
};

/**
 * Gallery showing empty, partial, and fully filled states side by side.
 */
export const Gallery: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium text-text-sub mb-2">Empty (no validation)</h3>
        <div className="rounded-lg border border-stroke-soft p-4">
          <WithStoreState>
            <DetailsStep showValidation={false} />
          </WithStoreState>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-sub mb-2">Empty (with validation errors)</h3>
        <div className="rounded-lg border border-stroke-soft p-4">
          <WithStoreState>
            <DetailsStep showValidation={true} />
          </WithStoreState>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-sub mb-2">Fully filled</h3>
        <div className="rounded-lg border border-stroke-soft p-4">
          <WithStoreState
            overrides={{
              name: "Savanna Watch",
              slug: "savanna-watch",
              description: "Documenting grassland restoration across East Africa.",
              location: "Nairobi, Kenya",
            }}
          >
            <DetailsStep showValidation={false} />
          </WithStoreState>
        </div>
      </div>
    </div>
  ),
};
