import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { withAdminIdentity, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { FIXTURE_IMAGE_PROFILE } from "../../../../shared/.storybook/fixtures";
import { RoleRemovalReview } from "./RoleRemovalReview";
import {
  ANA,
  CHIDI,
  KWAME,
  manageRolesIdentity,
  NEIGHBOR,
  personOf,
  TOMI,
} from "./manageRolesStoryFixtures";

const meta: Meta<typeof RoleRemovalReview> = {
  title: "Admin/Workflows/Garden/RoleRemovalReview",
  component: RoleRemovalReview,
  tags: ["autodocs", "storybook-ci"],
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(manageRolesIdentity(FIXTURE_IMAGE_PROFILE)),
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "The review of a removal: one row per person, each picked role on its own line with where it stands, then what the person keeps. Lines change in place and never reorder (DL-072).",
      },
    },
  },
  args: { chainId: DEFAULT_CHAIN_ID, viewer: ANA },
};

export default meta;
type Story = StoryObj<typeof RoleRemovalReview>;

/** Before signing: one role already gone and left out, and a steward whose rank still covers the role. */
export const Ready: Story = {
  args: {
    people: [
      { person: personOf(KWAME), pairs: [{ role: "evaluator", status: "ready" }] },
      { person: personOf(CHIDI), pairs: [{ role: "evaluator", status: "ready" }] },
      { person: personOf(TOMI), pairs: [{ role: "evaluator", status: "alreadyRemoved" }] },
      { person: personOf(NEIGHBOR), pairs: [{ role: "community", status: "ready" }] },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("Their Steward role still covers this on chain.")
    ).toBeVisible();
    await expect(canvas.getByText("No roles left, so they leave the member list")).toBeVisible();
  },
};

/** The run is on its second signature. */
export const Sending: Story = {
  args: {
    people: [
      { person: personOf(KWAME), pairs: [{ role: "evaluator", status: "removed" }] },
      { person: personOf(CHIDI), pairs: [{ role: "evaluator", status: "sending" }] },
      { person: personOf(TOMI), pairs: [{ role: "evaluator", status: "ready" }] },
    ],
  },
};

/** Every way a pair can end, each named in words. */
export const EveryOutcome: Story = {
  args: {
    people: [
      { person: personOf(KWAME), pairs: [{ role: "evaluator", status: "removed" }] },
      {
        person: personOf(CHIDI),
        pairs: [
          { role: "evaluator", status: "failed", reason: "The transaction ran out of gas." },
          { role: "gardener", status: "notSent" },
        ],
      },
      { person: personOf(TOMI), pairs: [{ role: "funder", status: "unknown" }] },
      {
        person: personOf(NEIGHBOR),
        pairs: [
          {
            role: "community",
            status: "refused",
            reason: "This garden's community role follows its own rules.",
          },
        ],
      },
    ],
  },
};
