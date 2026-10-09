import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { daysAgo } from "../../../../../shared/.storybook/fixtures";
import { HubAssessmentInspector, type HubAssessmentRecord } from "./HubAssessmentInspector";

const AUTHOR = "0x1111111111111111111111111111111111111111" as Address;

// Each end of a reporting period is stored as UTC midnight of the picked day.
const utcDay = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day) / 1000;

const ASSESSMENT: HubAssessmentRecord = {
  id: "0xabc1",
  title: "Eastern ridge baseline",
  description: "Where the ridge stands before the planting season, and what the season aims for.",
  domain: 1,
  startDate: utcDay(2025, 10, 1),
  endDate: utcDay(2025, 12, 31),
  location: "Eastern ridge, Rio Rainforest Lab",
  authorAddress: AUTHOR,
  createdAt: daysAgo(2),
};

const meta: Meta<typeof HubAssessmentInspector> = {
  title: "Admin/Workflows/Hub/HubAssessmentInspector",
  component: HubAssessmentInspector,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "An assessment's record, opened from the Hub's Assessments tab: what its attestation carries (description, domain, reporting period, location, author and date) and a link to it on EAS. When `canMint` is true the pinned act opens Create Hypercert.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-md p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    assessment: ASSESSMENT,
    chainId: 42161,
    onOpenMintFlow: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof HubAssessmentInspector>;

export const Steward: Story = {
  tags: ["storybook-ci"],
  args: { canMint: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = canvasElement.querySelector('[data-component="SheetBody"]');
    const footer = canvasElement.querySelector('[data-component="SheetFooter"]');

    await expect(body).not.toBeNull();
    await expect(footer).not.toBeNull();
    await expect(await canvas.findByText("Reporting period")).toBeVisible();
    await expect(await canvas.findByRole("button", { name: "Create Hypercert" })).toBeVisible();
    await expect(
      await canvas.findByRole("link", { name: "View Assessment on EAS Explorer" })
    ).toHaveAttribute("href", expect.stringContaining("0xabc1"));
  },
};

/** An evaluator reads the record; only owners and stewards can create the hypercert. */
export const ReadOnly: Story = {
  args: { canMint: false },
};

/** An attestation with no description, period or location, in a domain the cockpit does not know. */
export const SparseRecord: Story = {
  args: {
    canMint: true,
    assessment: {
      ...ASSESSMENT,
      id: "0xabc3",
      description: "",
      domain: 9,
      startDate: null,
      endDate: null,
      location: "",
      createdAt: daysAgo(200),
    },
  },
};
