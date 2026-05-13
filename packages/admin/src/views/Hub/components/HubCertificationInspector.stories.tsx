import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { daysAgo } from "../../../../../shared/.storybook/fixtures";
import { HubCertificationInspector } from "./HubCertificationInspector";

const meta: Meta<typeof HubCertificationInspector> = {
  title: "Admin/Workflows/Hub/HubCertificationInspector",
  component: HubCertificationInspector,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Sheet inspector for a selected certification. Contains the assessment summary and — when `canMint` is true — the pinned CTA into the mint flow.",
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
    onOpenMintFlow: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof HubCertificationInspector>;

export const Mintable: Story = {
  tags: ["storybook-ci"],
  args: {
    canMint: true,
    assessment: {
      id: "0xabc1",
      title: "Q1 restoration impact",
      description: "Bundle the March planting cohort and survival checks.",
      assessmentType: "impact",
      createdAt: daysAgo(2),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = canvasElement.querySelector('[data-component="SheetBody"]');
    const footer = canvasElement.querySelector('[data-component="SheetFooter"]');

    await expect(body).not.toBeNull();
    await expect(footer).not.toBeNull();
    await expect(await canvas.findByRole("button", { name: "Open mint flow" })).toBeVisible();
  },
};

export const ReadOnly: Story = {
  args: {
    canMint: false,
    assessment: {
      id: "0xabc2",
      title: "Workshop cohort results",
      description: null,
      assessmentType: "education",
      createdAt: daysAgo(6),
    },
  },
};

export const FallbackCopy: Story = {
  args: {
    canMint: true,
    assessment: {
      id: "0xabc3",
      title: null,
      description: null,
      assessmentType: null,
      createdAt: daysAgo(1),
    },
  },
};
