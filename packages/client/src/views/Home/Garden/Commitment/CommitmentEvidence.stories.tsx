import type {
  CommitmentEvidenceDocumentV1,
  EvidenceAttributionRow,
} from "@green-goods/shared/commitment-pooling";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, mocked, within } from "storybook/test";
import {
  JOURNEY_HELPER,
  JOURNEY_NAMES,
  JOURNEY_VIEWER,
  PROMISE_PAGE_SEEDS,
  promisePageFixture,
  todayAt,
} from "../../../../../../shared/.storybook/clientJourneyFixtures";
import { withAppPage, withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../../../shared/.storybook/moduleMocks";
import { CommitmentEvidence } from "./CommitmentEvidence";
import { CommitmentProgress } from "./CommitmentProgress";

/** The fence repair's photos, voice note and link, as the promise page stories pin them. */
const FENCE_PROOF = PROMISE_PAGE_SEEDS[0][1] as CommitmentEvidenceDocumentV1;
const REPAIR_NOTES = { url: "https://example.org/riverside/fence-repair", label: "Repair notes" };

const DOCUMENTS: Record<string, CommitmentEvidenceDocumentV1 | null> = {
  "bafy-fence-note": {
    version: 1,
    note: "Replaced the two split slats and rehung the gate.\n\nThe post by the compost bays still leans. It needs a new footing before the first frost.",
  },
  "bafy-fence-links": {
    version: 1,
    links: [
      REPAIR_NOTES,
      { url: "https://example.org/riverside/tool-shed/what-the-storm-took-and-what-we-replaced" },
    ],
  },
  "bafy-fence-full": {
    ...FENCE_PROOF,
    note: "Before and after the repair. The voice note walks the whole panel.",
  },
  // A document the gateway could not serve.
  "bafy-fence-gone": null,
};

function attribution(cid: string, attacher: Address, at: number): EvidenceAttributionRow {
  return { cid, contributor: attacher, attacher, createdAt: Math.floor(at / 1000) };
}

const { commitment } = promisePageFixture("added").controller.detail!;

/**
 * The proof on a promise's page, inside the section that holds it: each
 * proof's photos and voice notes as squares, its note and its links as the
 * confirmation sheet draws them, then who added it and when. Fictional data
 * from the fence repair the promise page stories follow.
 */
const meta: Meta<typeof CommitmentEvidence> = {
  title: "Client/Commitments/CommitmentEvidence",
  component: CommitmentEvidence,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobileSmall" } },
  decorators: [
    withSeededQueryClient(
      Object.entries(DOCUMENTS).map(
        ([cid, document]) => [queryKeys.commitmentPooling.evidence(cid), document] as const
      )
    ),
    withAppPage,
  ],
  beforeEach: () => {
    mocked(useActions).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useActions>);
    mocked(useEnsName).mockReturnValue({ data: null } as ReturnType<typeof useEnsName>);
    mocked(useGreenGoodsEnsName).mockImplementation(
      (address) =>
        ({ data: address ? (JOURNEY_NAMES[address.toLowerCase()] ?? null) : null }) as ReturnType<
          typeof useGreenGoodsEnsName
        >
    );
    return resetHookMocks(useActions, useEnsName, useGreenGoodsEnsName);
  },
  render: (args) => (
    <div className="p-4">
      <CommitmentProgress
        chainId={commitment.chainId}
        commitment={{ ...commitment, evidenceCount: args.recordedCount }}
        requirements={[]}
      >
        <CommitmentEvidence {...args} />
      </CommitmentProgress>
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof CommitmentEvidence>;

/** Words alone: the note reads as body text and keeps its paragraphs. */
export const NoteOnly: Story = {
  args: {
    attributions: [attribution("bafy-fence-note", JOURNEY_VIEWER, todayAt(10, 24))],
    recordedCount: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Replaced the two split slats/)).toBeVisible();
    await expect(canvas.queryByRole("list", { name: "Submitted proof" })).toBeNull();
    await expect(canvas.getByText(/Added today, 10:24/)).toHaveTextContent("by amara");
  },
};

/**
 * Links alone: each one is a row that opens in a new tab, every row one
 * height, a long address cut to one line with the whole of it on hover.
 */
export const LinksOnly: Story = {
  args: {
    attributions: [attribution("bafy-fence-links", JOURNEY_HELPER, todayAt(9, 5))],
    recordedCount: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const labelled = await canvas.findByRole("link", { name: "Repair notes" });
    await expect(labelled).toHaveAttribute("href", REPAIR_NOTES.url);
    const rows = canvas.getAllByRole("link");
    await expect(rows).toHaveLength(2);
    for (const row of rows) await expect(row.getBoundingClientRect().height).toBe(44);
  },
};

/** Everything at once: the squares first, then the note and the link, then who and when. */
export const NoteLinksAndMedia: Story = {
  args: {
    attributions: [attribution("bafy-fence-full", JOURNEY_VIEWER, todayAt(10, 24))],
    recordedCount: 1,
  },
};

/**
 * Proof that cannot be shown is said out loud: a document the gateway could
 * not serve, and a recorded proof with no readable row at all.
 */
export const UnreadableProof: Story = {
  args: {
    attributions: [
      attribution("bafy-fence-note", JOURNEY_VIEWER, todayAt(10, 24)),
      attribution("bafy-fence-gone", JOURNEY_HELPER, todayAt(9, 5)),
    ],
    recordedCount: 3,
  },
};
