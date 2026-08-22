import type {
  Address,
  CommitmentContributorRecord,
  CommitmentReadModel,
  CommitmentRequirementRecord,
} from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
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
  parameters: { viewport: { defaultViewport: "mobile1" }, layout: "fullscreen" },
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
    onConfirm: fn(),
    onNotYet: fn(),
    onDone: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmSheet>;

export const AskSupport: Story = {
  play: async () => {
    await expect(await screen.findByRole("button", { name: "Confirm it was kept" })).toBeVisible();
    await expect(screen.getByRole("button", { name: "Not yet" })).toBeVisible();
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
      await screen.findByRole("button", { name: "Confirm the work was done" })
    ).toBeVisible();
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

export const NotYet: Story = {
  play: async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Not yet" }));
    await expect(await screen.findByLabelText("What still needs doing?")).toBeVisible();
  },
};

export const NotYetOffline: Story = {
  args: { isOnline: false },
  play: async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Not yet" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Send to the stewards/ })).toBeDisabled()
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
