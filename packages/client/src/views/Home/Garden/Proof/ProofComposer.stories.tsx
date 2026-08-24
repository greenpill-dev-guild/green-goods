import type { Address } from "@green-goods/shared";
import type { CommitmentReadModel } from "@green-goods/shared/commitment-pooling";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, within } from "storybook/test";
import { withClientAppRuntime } from "../../../../../../shared/.storybook/decorators";
import { ProofDetails } from "./ProofDetails";
import { ProofMedia } from "./ProofMedia";
import { ProofReview } from "./ProofReview";
import { ProofShell, ProofState } from "./ProofShell";

const VIEWER = "0x1111111111111111111111111111111111111111" as Address;
const LEAD = "0x2222222222222222222222222222222222222222" as Address;

function commitment(overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return {
    id: "42161-9",
    chainId: 42161,
    commitmentId: 9n,
    creationSeen: true,
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE",
    state: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 3n,
    unitLabel: "hours",
    creator: LEAD,
    leadProvider: LEAD,
    counterparty: VIEWER,
    direction: "OFFER",
    commitmentType: "SUPPORT_SERVICE",
    confirmers: [],
    contributorCount: 2,
    contributorsFrozen: false,
    ...overrides,
  };
}

function photo(name: string): File {
  return new File([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" });
}

const ROSTER = [
  { address: LEAD, isLead: true },
  { address: VIEWER, isLead: false },
];

/**
 * The proof composer, beat by beat: what was done, who did it and the words
 * that go with it, then the review that says what adding it will do. Proof is
 * queued offline like work; the queued screen says so in the reader's actual
 * conditions.
 */
const meta: Meta = {
  title: "Client/Commitments/ProofComposer",
  tags: ["autodocs", "storybook-ci"],
  parameters: { viewport: { defaultViewport: "mobile1" }, layout: "fullscreen" },
  // TopNav reads the queue for its offline state, so the shell needs the
  // client runtime around it, as the AppBar story does.
  decorators: [
    (Story) => (
      <div className="flex h-[720px] flex-col bg-bg-white-0">
        <Story />
      </div>
    ),
    withClientAppRuntime,
  ],
};

export default meta;
type Story = StoryObj;

export const MediaEmpty: Story = {
  render: () => (
    <ProofShell onBack={fn()} progress={1}>
      <ProofMedia
        media={[]}
        audioNotes={[]}
        isProcessing={false}
        isRecording={false}
        recordingElapsed={0}
        onPick={fn()}
        onRemoveMedia={fn()}
        onRemoveAudio={fn()}
        onPreview={fn()}
      />
    </ProofShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Show what was done")).toBeVisible();
  },
};

export const MediaAttached: Story = {
  render: () => (
    <ProofShell onBack={fn()} progress={1}>
      <ProofMedia
        media={[photo("beds.png"), photo("compost.png")]}
        audioNotes={[new File([new Uint8Array([0])], "note.webm", { type: "audio/webm" })]}
        isProcessing={false}
        isRecording={false}
        recordingElapsed={0}
        onPick={fn()}
        onRemoveMedia={fn()}
        onRemoveAudio={fn()}
        onPreview={fn()}
      />
    </ProofShell>
  ),
};

export const MediaRecording: Story = {
  render: () => (
    <ProofShell onBack={fn()} progress={1}>
      <ProofMedia
        media={[photo("beds.png")]}
        audioNotes={[]}
        isProcessing={false}
        isRecording
        recordingElapsed={42}
        onPick={fn()}
        onRemoveMedia={fn()}
        onRemoveAudio={fn()}
        onPreview={fn()}
      />
    </ProofShell>
  ),
};

function DetailsDemo({ linkInvalid = false }: { linkInvalid?: boolean }) {
  const [credited, setCredited] = useState<Address[]>([VIEWER]);
  const [note, setNote] = useState("Turned the north beds and mulched the paths.");
  const [links, setLinks] = useState<string[]>([]);
  return (
    <ProofShell onBack={fn()} progress={2}>
      <ProofDetails
        roster={ROSTER}
        credited={credited}
        onToggleCredit={(address) =>
          setCredited((current) =>
            current.includes(address)
              ? current.filter((entry) => entry !== address)
              : [...current, address]
          )
        }
        viewer={VIEWER}
        note={note}
        onNote={setNote}
        links={links}
        onLinks={setLinks}
        linkInvalid={linkInvalid}
      />
    </ProofShell>
  );
}

export const Details: Story = {
  render: () => <DetailsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Who did this, and anything to add")).toBeVisible();
    const credits = canvas.getAllByRole("checkbox");
    await expect(credits).toHaveLength(2);
  },
};

export const DetailsInvalidLink: Story = {
  render: () => <DetailsDemo linkInvalid />,
};

export const Review: Story = {
  render: () => (
    <ProofShell onBack={fn()} progress={3}>
      <ProofReview
        commitment={commitment()}
        title="Compost delivery to the beds"
        mediaCount={2}
        audioCount={1}
        note="Turned the north beds and mulched the paths."
        links={["https://example.org/album"]}
        credited={[VIEWER, LEAD]}
        isOnline
      />
    </ProofShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Before you add this")).toBeVisible();
  },
};

export const ReviewOffline: Story = {
  render: () => (
    <ProofShell onBack={fn()} progress={3}>
      <ProofReview
        commitment={commitment({ direction: "REQUEST", commitmentType: "DOMAIN_IMPACT" })}
        title="Prune the north beds"
        mediaCount={1}
        audioCount={0}
        note=""
        links={[]}
        credited={[VIEWER]}
        isOnline={false}
      />
    </ProofShell>
  ),
};

export const Queued: Story = {
  render: () => <ProofState kind="queued" isOnline onBack={fn()} />,
};

export const QueuedOffline: Story = {
  render: () => <ProofState kind="queued" isOnline={false} onBack={fn()} />,
};

export const NotYours: Story = {
  render: () => <ProofState kind="notYours" isOnline onBack={fn()} />,
};
