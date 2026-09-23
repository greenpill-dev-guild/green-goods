import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen } from "storybook/test";
import { PoolCycleDialogs } from "./PoolCycleDialogs";
import { storyCycle, storyPoolConsole } from "./poolStoryFixtures";

const noop = () => undefined;
const endedSeason = storyCycle({ liveCommitmentCount: 0n });

const meta: Meta<typeof PoolCycleDialogs> = {
  title: "Admin/Pool/PoolCycleDialogs",
  component: PoolCycleDialogs,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "How a season or campaign ends. End reconciles a cycle whose commitments have all finished, ready for an impact certificate. Archive is final, and says so: no certificate can be made for the cycle afterwards. Both name the cycle in its pool first.",
      },
    },
  },
  args: {
    pool: storyPoolConsole(),
    target: { gardenName: "Rocinha", isProtocol: false },
    tone: "garden",
    setCycleDialog: noop,
    cycleDialog: { kind: "end", cycle: endedSeason },
  },
  decorators: [
    (Story) => (
      <div className="p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolCycleDialogs>;

export const EndSeason: Story = {
  play: async () => {
    const dialog = await screen.findByRole("dialog", { name: "End This Season" });
    await expect(dialog).toHaveTextContent("“Season of First Rains” in Rocinha’s pool");
  },
};

export const EndCampaign: Story = {
  args: {
    cycleDialog: {
      kind: "end",
      cycle: storyCycle({
        cycleId: 13n,
        cycleType: "CAMPAIGN",
        metadataCID: "bafy-campaign",
        liveCommitmentCount: 0n,
      }),
    },
  },
};

/** Archive is final: the dialog says no certificate can be made afterwards. */
export const ArchiveSeason: Story = {
  args: {
    cycleDialog: {
      kind: "archive",
      cycle: storyCycle({ state: "RECONCILED", liveCommitmentCount: 0n }),
    },
  },
  play: async () => {
    const dialog = await screen.findByRole("alertdialog", { name: "Archive This Season" });
    await expect(dialog).toHaveTextContent(/no impact certificate can be made for this season/);
  },
};
