import type { Meta, StoryObj } from "@storybook/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, userEvent, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../../shared/.storybook/decorators";
import { storyCycle, storyNotReadyPool, storyPool, storyPoolConsole } from "../poolStoryFixtures";
import { PoolSetupFlow } from "./index";

const meta: Meta<typeof PoolSetupFlow> = {
  title: "Admin/Pool/PoolSetupFlow",
  component: PoolSetupFlow,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "W11: first-run setup, a new season, a campaign, or opening a prepared cycle, in one flow dialog. Nothing is written until the last step; a failure names what landed and the retry repeats only the unlanded call.",
      },
    },
  },
  args: { open: true, onClose: () => undefined },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    // useDirtyClose blocks route changes through a data router.
    (Story) => (
      <RouterProvider
        router={createMemoryRouter([{ path: "/garden/pool", element: <Story /> }], {
          initialEntries: ["/garden/pool"],
        })}
      />
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolSetupFlow>;

export const FirstRun: Story = {
  args: {
    intent: "first-run",
    console: storyPoolConsole({
      pool: storyNotReadyPool(),
      cycles: [],
      commitments: [],
      claims: [],
      charter: { charter: null, isLoading: false, isUnavailable: false },
    }),
  },
  play: async () => {
    const dialog = within(document.body);
    await expect(await dialog.findByRole("heading", { name: "How it works" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Next" })).toBeDisabled();
    await userEvent.type(dialog.getByLabelText("What this pool is for"), "Neighbourly help in Rio");
    await expect(dialog.getByRole("button", { name: "Next" })).toBeEnabled();
  },
};

export const NewSeason: Story = {
  args: {
    intent: "season",
    console: storyPoolConsole({
      pool: storyPool({
        state: "READY",
        openSeasonCycleId: null,
        openCampaignIds: [],
        nonTerminalCycleCount: 0n,
      }),
      cycles: [],
      commitments: [],
      claims: [],
    }),
  },
};

export const Campaign: Story = {
  args: { intent: "campaign", console: storyPoolConsole() },
};

export const OpenPreparedSeason: Story = {
  args: {
    intent: "open-season",
    cycle: storyCycle({ state: "SEEDED", liveCommitmentCount: 0n }),
    console: storyPoolConsole({
      pool: storyPool({ state: "READY", openSeasonCycleId: null, openCampaignIds: [] }),
      cycles: [storyCycle({ state: "SEEDED", liveCommitmentCount: 0n })],
      commitments: [],
      claims: [],
    }),
  },
};
