import { useSlugAvailability } from "@green-goods/shared/hooks/ens/useSlugAvailability";
import { useCreateGardenStore } from "@green-goods/shared/stores/useCreateGardenStore";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { expect, mocked, waitFor, within } from "storybook/test";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Storybook initializer: run once on mount only
  }, []);

  return <>{children}</>;
}

const meta: Meta<typeof DetailsStep> = {
  title: "Admin/Workflows/Garden/DetailsStep",
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

const RIO_GARDEN = {
  name: "Rio Rainforest Lab",
  slug: "rio-rainforest-lab",
  description:
    "A community-driven regenerative effort to document and protect native species in the Atlantic Forest biome near Rio de Janeiro.",
  location: "Rio de Janeiro, Brazil",
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
      <WithStoreState overrides={RIO_GARDEN}>
        <Story />
      </WithStoreState>
    ),
  ],
};

/** Answers the Web name check the way the chain, or a failed read, settles it. */
function settleWebNameCheck(state: { data: boolean | undefined; isError: boolean }) {
  mocked(useSlugAvailability).mockReturnValue({ ...state, isFetching: false } as ReturnType<
    typeof useSlugAvailability
  >);
  return resetHookMocks(useSlugAvailability);
}

/**
 * The chain says the web name is already held, so the field says it is taken.
 */
export const WebNameTaken: Story = {
  tags: ["storybook-ci"],
  args: {
    showValidation: false,
  },
  beforeEach: () => settleWebNameCheck({ data: false, isError: false }),
  decorators: [
    (Story) => (
      <WithStoreState overrides={RIO_GARDEN}>
        <Story />
      </WithStoreState>
    ),
  ],
  play: async ({ canvasElement }) => {
    const webName = within(canvasElement).getByRole("textbox", { name: "Web name" });
    await waitFor(() => expect(webName).toHaveAccessibleDescription("This name is already taken"));
    await expect(webName).toHaveAttribute("aria-invalid", "true");
  },
};

/**
 * The check couldn't reach the chain, so the field says the name wasn't checked. It does not
 * call the name taken: submit asks again, and the mint has the final say.
 */
export const WebNameUnchecked: Story = {
  tags: ["storybook-ci"],
  args: {
    showValidation: false,
  },
  beforeEach: () => settleWebNameCheck({ data: undefined, isError: true }),
  decorators: [
    (Story) => (
      <WithStoreState overrides={RIO_GARDEN}>
        <Story />
      </WithStoreState>
    ),
  ],
  play: async ({ canvasElement }) => {
    const webName = within(canvasElement).getByRole("textbox", { name: "Web name" });
    await waitFor(() =>
      expect(webName).toHaveAccessibleDescription(
        "We couldn't check this name. We'll check it again when you create the garden."
      )
    );
    await expect(webName).not.toHaveAttribute("aria-invalid");
  },
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

/**
 * Consolidated state catalog — use the theme toolbar for dark mode.
 */
export const StateCatalog: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="type-body font-medium text-text-sub mb-2">Empty (no validation)</h3>
        <div className="rounded-lg border border-stroke-soft p-4">
          <WithStoreState>
            <DetailsStep showValidation={false} />
          </WithStoreState>
        </div>
      </div>

      <div>
        <h3 className="type-body font-medium text-text-sub mb-2">Empty (with validation errors)</h3>
        <div className="rounded-lg border border-stroke-soft p-4">
          <WithStoreState>
            <DetailsStep showValidation={true} />
          </WithStoreState>
        </div>
      </div>

      <div>
        <h3 className="type-body font-medium text-text-sub mb-2">Fully filled</h3>
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
