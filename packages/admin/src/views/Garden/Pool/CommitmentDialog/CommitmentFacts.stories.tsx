import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { CommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { type Action, Domain } from "@green-goods/shared/types/domain";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import {
  STORY_ANA,
  STORY_JOAO,
  storyCommitment,
  storyCommitmentDialog,
} from "../poolStoryFixtures";
import { CommitmentFacts } from "./CommitmentFacts";

const dialog = storyCommitmentDialog();

const meta: Meta<typeof CommitmentFacts> = {
  title: "Admin/Pool/CommitmentFacts",
  component: CommitmentFacts,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A commitment's checkable facts: what was promised, what proof stands behind it, who may confirm it, and once it is kept, who did and on what authority.",
      },
    },
  },
  args: {
    commitment: storyCommitment({ evidenceCount: 2, targetUnits: 1n, unitLabel: "repair session" }),
    detail: dialog.detail,
  },
  decorators: [
    (Story) => (
      <div className="max-w-md p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentFacts>;

export const Accepted: Story = {};

export const NamedConfirmers: Story = {
  args: {
    commitment: storyCommitment({
      evidenceCount: 2,
      confirmers: [STORY_JOAO, STORY_ANA],
      confirmationThreshold: 2,
      protocolFallbackEnabled: false,
    }),
  },
};

export const ConfirmedOrdinary: Story = {
  args: {
    commitment: storyCommitment({
      onchainState: "FULFILLED",
      derivedState: "FULFILLED",
      state: "FULFILLED",
      evidenceCount: 2,
      confirmationCount: 1,
      fulfilledBy: STORY_JOAO,
      confirmationPath: "ORDINARY",
    }),
  },
};

export const ConfirmedByGardenFallback: Story = {
  args: {
    commitment: storyCommitment({
      onchainState: "FULFILLED",
      derivedState: "FULFILLED",
      state: "FULFILLED",
      evidenceCount: 2,
      confirmationCount: 1,
      readyOverridden: true,
      confirmationPath: "POOL_FALLBACK",
      fallbackReason: "Confirmed on a site visit; the recipient has no device.",
    }),
  },
};

/**
 * A promise with a target is the goal (PRD-1538): 30 waste pickups, 26 sent toward it and 24
 * approved, in the action's own count. A second target in another action keeps its own line.
 */
const storyAction = (uid: number, slug: string, title: string): Action => ({
  id: `${STORY_CHAIN}-${uid}`,
  slug,
  title,
  inputs: [],
  description: "",
  domain: Domain.WASTE,
  capitals: [],
  media: [],
  createdAt: 0,
  startTime: 0,
  endTime: 0,
});
const STORY_CHAIN = storyCommitment().chainId;

export const WasteTargets: Story = {
  tags: ["storybook-ci"],
  decorators: [
    withSeededQueryClient([
      [
        queryKeys.actions.byUIDs(STORY_CHAIN, [1, 2]),
        [
          storyAction(1, "waste.pickup", "Waste pickup"),
          storyAction(2, "waste.sorting", "Sorting session"),
        ],
      ],
    ]),
  ],
  args: {
    detail: {
      ...(dialog.detail as NonNullable<CommitmentDialogController["detail"]>),
      requirements: [
        { requirementIndex: 0, actionUID: 1n, requiredCount: 30, approvedCount: 24 },
        { requirementIndex: 1, actionUID: 2n, requiredCount: 10, approvedCount: 3 },
      ].map((row) => ({
        ...row,
        id: `42161-7-${row.requirementIndex}`,
        chainId: 42161,
        commitmentId: 7n,
        creationSeen: true as const,
        domain: 3,
        createdAt: 0,
        updatedAt: 0,
      })),
      workAttributions: Array.from({ length: 30 }, (_, index) => ({
        id: `42161-work-${index}`,
        chainId: 42161,
        workUID: `0x${index.toString(16).padStart(64, "0")}` as `0x${string}`,
        commitmentId: 7n,
        linkSeen: true as const,
        contributor: STORY_ANA,
        requirementIndex: index < 26 ? 0 : 1,
        operationKey: null,
        linked: true,
        creditActive: true,
        linkedBy: STORY_ANA,
        linkedAt: 0,
        unlinkedBy: null,
        unlinkedAt: null,
        updatedAt: 0,
      })),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("24 approved, 26 reported, of 30")).toBeVisible();
    await expect(canvas.getByText("3 approved, 4 reported, of 10")).toBeVisible();
  },
};
