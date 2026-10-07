import { useCreateAssessmentStore } from "@green-goods/shared/stores/useCreateAssessmentStore";
import { CynefinPhase, Domain, type SmartOutcome } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { StrategyKernelStep } from "./StrategyKernelStep";

interface Seed {
  domain?: Domain;
  diagnosis?: string;
  smartOutcomes?: SmartOutcome[];
  cynefinPhase?: CynefinPhase;
}

function WithAssessmentStore({ seed, children }: { seed: Seed; children: React.ReactNode }) {
  const setField = useCreateAssessmentStore((s) => s.setField);
  const reset = useCreateAssessmentStore((s) => s.reset);

  useEffect(() => {
    reset();
    if (seed.domain !== undefined) setField("domain", seed.domain);
    if (seed.diagnosis !== undefined) setField("diagnosis", seed.diagnosis);
    if (seed.smartOutcomes !== undefined) setField("smartOutcomes", seed.smartOutcomes);
    if (seed.cynefinPhase !== undefined) setField("cynefinPhase", seed.cynefinPhase);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per story mount
  }, []);

  return <>{children}</>;
}

const meta: Meta<typeof StrategyKernelStep> = {
  title: "Admin/Workflows/Assessment/StrategyKernelStep",
  component: StrategyKernelStep,
  tags: ["autodocs"],
  argTypes: {
    showValidation: { control: "boolean" },
    isSubmitting: { control: "boolean" },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Assessment wizard step 2. Diagnosis, SMART outcomes (repeater), and Cynefin phase selector. Every control sits on the step's own edges, and Add Outcome stays in the section's title row. The collection explains once what its fields hold: the change, what is counted, and how much (DL-079, DL-087). Writes to the persisted Zustand store.",
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
type Story = StoryObj<typeof StrategyKernelStep>;

const RESTORATION_DIAGNOSIS =
  "Degraded pasture with <1% soil organic matter; fragmented native species corridors limit pollinator movement.";

/** As the step opens: one blank outcome, whose Remove waits for a second. */
export const Empty: Story = {
  decorators: [
    (Story) => (
      <WithAssessmentStore seed={{ domain: Domain.AGRO }}>
        <Story />
      </WithAssessmentStore>
    ),
  ],
};

/**
 * After Next: no challenge, an outcome with no words, one with no metric, a
 * metric used twice, and a negative target. Each message sits under its own
 * field, on the line the field always reserves.
 */
export const WithValidationErrors: Story = {
  args: {
    showValidation: true,
  },
  decorators: [
    (Story) => (
      <WithAssessmentStore
        seed={{
          domain: Domain.AGRO,
          smartOutcomes: [
            { description: "", metric: "treesPlanted", target: 200 },
            { description: "The corridor is one habitat again", metric: "", target: 5 },
            { description: "More native species live here", metric: "treesPlanted", target: -1 },
          ],
        }}
      >
        <Story />
      </WithAssessmentStore>
    ),
  ],
};

/**
 * Three outcomes: each is one line of Outcome, Metric and Target, with Remove at its end. An
 * outcome names a change in people or land, and its count sits in Metric and Target (DL-079).
 */
export const Prefilled: Story = {
  decorators: [
    (Story) => (
      <WithAssessmentStore
        seed={{
          domain: Domain.AGRO,
          diagnosis: RESTORATION_DIAGNOSIS,
          smartOutcomes: [
            {
              description: "Native forest grows back on the degraded pasture",
              metric: "treesPlanted",
              target: 200,
            },
            {
              description: "The corridor is one habitat again",
              metric: "areaCoveredHa",
              target: 5,
            },
            { description: "More native species live here", metric: "speciesCount", target: 12 },
          ],
          cynefinPhase: CynefinPhase.COMPLEX,
        }}
      >
        <Story />
      </WithAssessmentStore>
    ),
  ],
};

export const SubmittingState: Story = {
  args: {
    isSubmitting: true,
  },
  decorators: [
    (Story) => (
      <WithAssessmentStore
        seed={{
          domain: Domain.SOLAR,
          diagnosis: "Rural households rely on diesel generators averaging 4h/day.",
          smartOutcomes: [
            {
              description: "Households in the neighbourhood have reliable power after dark",
              metric: "householdsServed",
              target: 50,
            },
          ],
          cynefinPhase: CynefinPhase.COMPLICATED,
        }}
      >
        <Story />
      </WithAssessmentStore>
    ),
  ],
};

/**
 * The step's two layout promises, checked in browser mode where real layout
 * applies: every control ends on the challenge field's left and right edges,
 * and Add Outcome sits at the end of the title row, above the list, so three
 * presses move neither it nor the fields of the row already there. Every
 * measure is an edge or an offset inside the grid, so the check reads the same
 * whichever font the page has loaded.
 */
export const OutcomesHoldStill: Story = {
  tags: ["storybook-ci"],
  decorators: [
    (Story) => (
      <WithAssessmentStore seed={{ domain: Domain.AGRO, diagnosis: RESTORATION_DIAGNOSIS }}>
        <Story />
      </WithAssessmentStore>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fieldBox = (control: HTMLElement) =>
      (control.closest('[data-region="field-container"]') ?? control).getBoundingClientRect();
    const rows = () =>
      Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-region="outcome-row"]'));

    const challenge = await canvas.findByRole("textbox", { name: /The challenge/ });
    await waitFor(() => expect(rows()).toHaveLength(1));
    const edges = fieldBox(challenge);
    const onTheStepEdges = async (box: DOMRect) => {
      await expect(Math.abs(box.left - edges.left)).toBeLessThan(1);
      await expect(Math.abs(box.right - edges.right)).toBeLessThan(1);
    };

    await onTheStepEdges(rows()[0].getBoundingClientRect());
    await expect(
      Math.abs(fieldBox(canvas.getByRole("textbox", { name: "Outcome" })).left - edges.left)
    ).toBeLessThan(1);
    await onTheStepEdges(
      canvas
        .getByRole("radiogroup", { name: "How Predictable Is This Work?" })
        .getBoundingClientRect()
    );

    const add = canvas.getByRole("button", { name: "Add Outcome" });
    const title = canvas.getByRole("heading", { name: "What You'll Measure" });
    const addHoldsTheTitleRow = async () => {
      const button = add.getBoundingClientRect();
      await expect(Math.abs(button.right - edges.right)).toBeLessThan(1);
      await expect(Math.abs(button.top - title.getBoundingClientRect().top)).toBeLessThan(3);
      await expect(button.bottom).toBeLessThanOrEqual(rows()[0].getBoundingClientRect().top);
    };
    // The first row's Metric, placed against its own row.
    const firstMetric = canvas.getAllByRole("combobox")[0];
    const metricPlace = () => {
      const row = rows()[0].getBoundingClientRect();
      const metric = fieldBox(firstMetric);
      return { x: Math.round(metric.left - row.left), y: Math.round(metric.top - row.top) };
    };
    await addHoldsTheTitleRow();
    const metricAt = metricPlace();

    for (const count of [2, 3, 4]) {
      await userEvent.click(add);
      await waitFor(() => expect(rows()).toHaveLength(count));
      await addHoldsTheTitleRow();
      await expect(metricPlace()).toEqual(metricAt);
    }
    for (const row of rows()) await onTheStepEdges(row.getBoundingClientRect());
    await expect(canvas.getAllByText("The change you want to see")).toHaveLength(1);
    await expect(canvas.getAllByText("What you'll count")).toHaveLength(1);
    await expect(canvas.getAllByText("How much")).toHaveLength(1);
  },
};
