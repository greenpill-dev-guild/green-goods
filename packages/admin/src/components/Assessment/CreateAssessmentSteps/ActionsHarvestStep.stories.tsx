import {
  type Action,
  DEFAULT_CHAIN_ID,
  Domain,
  queryKeys,
  useCreateAssessmentStore,
} from "@green-goods/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { ActionsHarvestStep } from "./ActionsHarvestStep";

// Use the build-time chain id so the seed matches whatever `useCurrentChain()` returns.
const CHAIN_ID = DEFAULT_CHAIN_ID;

function makeAction(id: string, domain: Domain, title: string, slug: string): Action {
  return {
    id,
    slug,
    title,
    domain,
    startTime: 0,
    endTime: 0,
    createdAt: 0,
    capitals: [],
    media: [],
    description: "",
    inputs: [],
  };
}

const MOCK_ACTIONS: Action[] = [
  makeAction("1", Domain.AGRO, "Site assessment & species plan", "agro.site_species_plan"),
  makeAction("2", Domain.AGRO, "Planting event", "agro.planting_event"),
  makeAction("3", Domain.AGRO, "Survival check", "agro.survival_check"),
  makeAction("4", Domain.SOLAR, "Site & readiness setup", "solar.site_setup"),
];

function WithSeededClient({ actions, children }: { actions: Action[]; children: React.ReactNode }) {
  const [client] = useState(() => {
    const c = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    c.setQueryData(queryKeys.actions.byChain(CHAIN_ID), actions);
    return c;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

interface Seed {
  domain?: Domain;
  selectedActionUIDs?: string[];
  reportingPeriodStart?: string;
  reportingPeriodEnd?: string;
}

function WithAssessmentStore({ seed, children }: { seed: Seed; children: React.ReactNode }) {
  const setField = useCreateAssessmentStore((s) => s.setField);
  const reset = useCreateAssessmentStore((s) => s.reset);

  useEffect(() => {
    reset();
    setField("domain", seed.domain ?? Domain.AGRO);
    setField("selectedActionUIDs", seed.selectedActionUIDs ?? []);
    if (seed.reportingPeriodStart) setField("reportingPeriodStart", seed.reportingPeriodStart);
    if (seed.reportingPeriodEnd) setField("reportingPeriodEnd", seed.reportingPeriodEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per story mount
  }, []);

  return <>{children}</>;
}

const meta: Meta<typeof ActionsHarvestStep> = {
  title: "Admin/Workflows/Assessment/ActionsHarvestStep",
  component: ActionsHarvestStep,
  tags: ["autodocs"],
  argTypes: {
    showValidation: { control: "boolean" },
    isSubmitting: { control: "boolean" },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Assessment wizard step 3. Action multi-select filtered by the selected domain, plus the reporting period date range. Actions are seeded into React Query (`queryKeys.actions.byChain`) so the list renders without a live indexer.",
      },
    },
  },
  args: {
    showValidation: false,
    isSubmitting: false,
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
type Story = StoryObj<typeof ActionsHarvestStep>;

export const Empty: Story = {
  decorators: [
    (Story) => (
      <WithSeededClient actions={MOCK_ACTIONS}>
        <WithAssessmentStore seed={{}}>
          <Story />
        </WithAssessmentStore>
      </WithSeededClient>
    ),
  ],
};

export const WithSelection: Story = {
  decorators: [
    (Story) => (
      <WithSeededClient actions={MOCK_ACTIONS}>
        <WithAssessmentStore
          seed={{
            selectedActionUIDs: ["1", "2"],
            reportingPeriodStart: "2026-01-01",
            reportingPeriodEnd: "2026-03-31",
          }}
        >
          <Story />
        </WithAssessmentStore>
      </WithSeededClient>
    ),
  ],
};

export const NoActionsForDomain: Story = {
  decorators: [
    (Story) => (
      <WithSeededClient actions={[]}>
        <WithAssessmentStore seed={{ domain: Domain.EDU }}>
          <Story />
        </WithAssessmentStore>
      </WithSeededClient>
    ),
  ],
};

export const WithValidationErrors: Story = {
  args: {
    showValidation: true,
  },
  decorators: [
    (Story) => (
      <WithSeededClient actions={MOCK_ACTIONS}>
        <WithAssessmentStore seed={{}}>
          <Story />
        </WithAssessmentStore>
      </WithSeededClient>
    ),
  ],
};
