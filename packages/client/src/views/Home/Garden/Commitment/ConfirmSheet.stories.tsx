import type { Address } from "@green-goods/shared/types/domain";
import type {
  CommitmentContributorRecord,
  CommitmentReadModel,
  CommitmentRequirementRecord,
} from "@green-goods/shared/commitment-pooling";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import {
  promisePageFixture,
  PROMISE_PAGE_SEEDS,
  JOURNEY_NEIGHBOUR,
} from "../../../../../../shared/.storybook/clientJourneyFixtures";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import { ConfirmSheet } from "./ConfirmSheet";

const VIEWER = "0x1111111111111111111111111111111111111111" as Address;
const PROVIDER = "0x2222222222222222222222222222222222222222" as Address;
const STEWARD = "0x3333333333333333333333333333333333333333" as Address;

function commitment(overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return {
    id: "42161-9",
    chainId: 42161,
    commitmentId: 9n,
    creationSeen: true,
    onchainState: "READY_FOR_CONFIRMATION",
    derivedState: "READY_FOR_CONFIRMATION",
    state: "READY_FOR_CONFIRMATION",
    approvedUnits: 0n,
    evidenceCount: 2,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 3n,
    unitLabel: "hours",
    creator: PROVIDER,
    leadProvider: PROVIDER,
    counterparty: VIEWER,
    direction: "OFFER",
    commitmentType: "SUPPORT_SERVICE",
    confirmers: [],
    confirmationCount: 0,
    confirmationThreshold: 1,
    contributorCount: 1,
    contributorsFrozen: true,
    ...overrides,
  };
}

const lead: CommitmentContributorRecord = {
  id: "c-lead",
  chainId: 42161,
  commitmentId: 9n,
  contributor: PROVIDER,
  additionSeen: true,
  active: true,
  isLead: true,
  approvedWorkCredits: 0,
  evidenceCredits: 2,
  uncountedLinkedWorkCount: 0,
  requirementIndexes: [],
  recognitionWeightBps: null,
  addedBy: null,
  addedAt: null,
  removedBy: null,
  removedAt: null,
  updatedAt: 0,
};

const requirement: CommitmentRequirementRecord = {
  id: "r0",
  chainId: 42161,
  commitmentId: 9n,
  requirementIndex: 0,
  creationSeen: true,
  domain: null,
  actionUID: 44n,
  requiredCount: 2,
  approvedCount: 2,
  createdAt: 0,
  updatedAt: 0,
};

/**
 * The question a confirmer is asked, with its two answers. Each cast asks in
 * its own words; Not yet takes a reason and raises a dispute, never cancels;
 * the pending and kept screens say what the record now holds.
 */
const meta: Meta<typeof ConfirmSheet> = {
  title: "Client/Commitments/ConfirmSheet",
  component: ConfirmSheet,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: {
    open: true,
    onOpenChange: fn(),
    commitment: commitment(),
    requirements: [],
    contributors: [lead],
    viewer: VIEWER,
    isOnline: true,
    phase: "ask",
    isPending: false,
    notYetFailed: false,
    // The reader here is an ordinary confirmer, so the chain would take a
    // dispute from them. A steward acting only for a claiming garden is the
    // case that hides it; that is the detail screen's call, not the sheet's.
    canNotYet: true,
    canConfirm: true,
    onConfirm: fn(),
    onNotYet: fn(),
    onDone: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmSheet>;

export const AskSupport: Story = {
  play: async () => {
    await expect(await screen.findByRole("button", { name: "Confirm It Was Kept" })).toBeVisible();
    await expect(screen.getByRole("button", { name: "Not Yet" })).toBeVisible();
    await expect(screen.getByText("2 items")).toBeVisible();
    await expect(
      screen.getByText("2 pieces of proof are recorded but cannot be shown right now.")
    ).toBeVisible();
  },
};

export const MultipleProofs: Story = {
  args: {
    evidenceAttributions: [
      { cid: "bafy-proof-one", contributor: PROVIDER, createdAt: 1_700_000_001 },
      { cid: "bafy-proof-two", contributor: PROVIDER, createdAt: 1_700_000_002 },
    ],
  },
  play: async () => {
    await expect(await screen.findByText("2 items")).toBeVisible();
    await expect(screen.queryByText("No proof has been attached yet.")).not.toBeInTheDocument();
  },
};

export const AskGardenWork: Story = {
  args: {
    commitment: commitment({
      direction: "REQUEST",
      commitmentType: "DOMAIN_IMPACT",
      creator: VIEWER,
      leadProvider: PROVIDER,
      counterparty: PROVIDER,
    }),
    requirements: [requirement],
  },
  play: async () => {
    await expect(
      await screen.findByRole("button", { name: "Confirm the Work Was Done" })
    ).toBeVisible();
  },
};

/**
 * A request that is not garden work, read by the person who asked: a course a garden asked
 * members to complete reads the same as a ride someone asked for, so it asks if it was kept.
 */
export const AskSupportRequest: Story = {
  args: {
    commitment: commitment({
      direction: "REQUEST",
      creator: VIEWER,
      leadProvider: PROVIDER,
      counterparty: PROVIDER,
      targetUnits: 1n,
      unitLabel: "certificates",
    }),
  },
  play: async () => {
    await expect(await screen.findByRole("dialog", { name: "Promise kept?" })).toBeVisible();
    await expect(screen.getByRole("button", { name: "Confirm It Was Kept" })).toBeVisible();
    await expect(screen.queryByText(/help/i)).not.toBeInTheDocument();
  },
};

export const AskCaptured: Story = {
  args: { commitment: commitment({ recordedBy: STEWARD }) },
};

export const NamedGroup: Story = {
  args: {
    commitment: commitment({
      counterparty: PROVIDER,
      confirmers: [VIEWER, STEWARD],
      confirmationCount: 1,
      confirmationThreshold: 2,
    }),
  },
};

/**
 * A request a steward seeded with named confirmers, read by one of them. They did not ask for
 * it, and the person who asked does not confirm by asking, so the sheet says neither.
 */
export const NamedGroupRequest: Story = {
  args: {
    commitment: commitment({
      direction: "REQUEST",
      creator: STEWARD,
      leadProvider: PROVIDER,
      counterparty: PROVIDER,
      confirmers: [VIEWER, STEWARD],
    }),
  },
  play: async () => {
    await expect(await screen.findByText(/The named people do\./)).toBeVisible();
    await expect(screen.queryByText(/You asked/)).not.toBeInTheDocument();
  },
};

export const NotYet: Story = {
  play: async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Not Yet" }));
    await expect(await screen.findByLabelText("What still needs doing?")).toBeVisible();
  },
};

export const NotYetOffline: Story = {
  args: { isOnline: false },
  play: async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Not Yet" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Send to the Stewards/ })).toBeDisabled()
    );
  },
};

export const Pending: Story = {
  args: { phase: "pending" },
};

export const PendingOffline: Story = {
  args: { phase: "pending", isOnline: false },
};

export const Kept: Story = {
  args: {
    phase: "confirmed",
    commitment: commitment({
      derivedState: "FULFILLED",
      onchainState: "FULFILLED",
      confirmationCount: 1,
      fulfilledBy: VIEWER,
      confirmationPath: "ORDINARY",
    }),
  },
};

export const KeptByFallback: Story = {
  args: {
    phase: "confirmed",
    commitment: commitment({
      derivedState: "FULFILLED",
      onchainState: "FULFILLED",
      confirmationCount: 1,
      fulfilledBy: STEWARD,
      confirmationPath: "POOL_FALLBACK",
      fallbackReason: "The counterparty left the garden before confirming.",
    }),
  },
};

/** The same fence repair as the proof guide, now read by its independent confirmer. */
export const Documentation: Story = {
  decorators: [withSeededQueryClient(PROMISE_PAGE_SEEDS)],
  args: (() => {
    const { detail } = promisePageFixture("waiting").controller;
    return {
      commitment: {
        ...detail!.commitment,
        confirmers: [JOURNEY_NEIGHBOUR, STEWARD],
        confirmationCount: 1,
        confirmationThreshold: 2,
      },
      contributors: detail!.contributors,
      evidenceAttributions: detail!.evidenceAttributions,
      viewer: JOURNEY_NEIGHBOUR,
    };
  })(),
};

export const DocumentationNotYet: Story = {
  ...Documentation,
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Not Yet" }));
    await userEvent.type(
      await screen.findByLabelText("What still needs doing?"),
      "The replacement slats are secure. Please also check the loose rail beside the compost bay before we call the repair finished."
    );
  },
};
