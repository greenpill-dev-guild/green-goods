import type { Address } from "@green-goods/shared/types/domain";
import type { CommitmentCycleRecord } from "@green-goods/shared/commitment-pooling";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import { CycleRail } from "./CycleRail";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const SPRING_CID = "bafyspring";
const WORKDAY_CID = "bafyworkday";
// Noon UTC so the rendered dates do not drift across the viewer's timezone.
const MAR_1 = 1_772_366_400n;
const MAY_31 = 1_780_228_800n;
const APR_12 = 1_775_995_200n;

function cycle(overrides: Partial<CommitmentCycleRecord> = {}): CommitmentCycleRecord {
  return {
    id: "42161-3",
    chainId: 42161,
    cycleId: 3n,
    seedSeen: true,
    poolId: 7n,
    poolEntityId: "42161-7",
    garden: GARDEN,
    gardenId: GARDEN,
    cycleType: "SEASON",
    state: "OPEN",
    startTime: MAR_1,
    endTime: MAY_31,
    metadataCID: SPRING_CID,
    gardenersBps: 0,
    treasuryBps: 0,
    operatorBps: 0,
    evaluatorBps: 0,
    communityBps: 0,
    funderBps: 0,
    equalParticipationBps: 0,
    verifiedContributionBps: 0,
    liveCommitmentCount: 4n,
    commitmentsAccepted: 4n,
    commitmentsReadyForConfirmation: 1n,
    commitmentsFulfilled: 2n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 0n,
    commitmentsDisputed: 0n,
    commitmentsDue: 1n,
    openCommitmentCount: 2n,
    createdAt: 1_772_000_000,
    updatedAt: 1_772_000_000,
    ...overrides,
  };
}

const season = cycle();
const campaign = cycle({
  id: "42161-4",
  cycleId: 4n,
  cycleType: "CAMPAIGN",
  startTime: APR_12,
  endTime: APR_12,
  metadataCID: WORKDAY_CID,
  liveCommitmentCount: 1n,
  commitmentsFulfilled: 0n,
  openCommitmentCount: 1n,
});

/** The cycle names live behind CIDs; the seeded cache stands in for the gateway. */
const cycleNameKey = (cid: string) =>
  ["greengoods", "commitment-pooling", "cycle-metadata", cid] as const;

/**
 * The seasons and campaigns a pool is running, as a horizontal rail. Kind is
 * told by its own word and glyph, never by colour alone, and each slide's
 * counts are its own: a season and a campaign are never summed.
 */
const meta: Meta<typeof CycleRail> = {
  title: "Client/Commitments/CycleRail",
  component: CycleRail,
  tags: ["autodocs", "storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  decorators: [
    withSeededQueryClient([
      [cycleNameKey(SPRING_CID), { status: "resolved", name: "Spring 2026" }],
      [cycleNameKey(WORKDAY_CID), { status: "resolved", name: "Community work day" }],
    ]),
    (Story) => (
      <div className="max-w-sm p-4">
        <Story />
      </div>
    ),
  ],
  args: { cycles: [season, campaign], selectedCycleId: null, onSelect: fn() },
};

export default meta;
type Story = StoryObj<typeof CycleRail>;

export const SeasonAndCampaign: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Spring 2026")).toBeVisible();
    await expect(canvas.getByText("Community work day")).toBeVisible();
  },
};

export const SeasonSelected: Story = {
  args: { selectedCycleId: 3n },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pressed = canvas
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    await expect(pressed).toHaveLength(1);
  },
};

export const UnnamedCycle: Story = {
  args: { cycles: [cycle({ metadataCID: null })] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Season")).toBeVisible();
  },
};

/** An empty rail draws nothing at all; the pool tab has no gap to explain. */
export const NoCycles: Story = {
  args: { cycles: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("group")).not.toBeInTheDocument();
  },
};
