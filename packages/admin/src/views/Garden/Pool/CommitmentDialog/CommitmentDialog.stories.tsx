import { parseCommitmentEvidenceDocument } from "@green-goods/shared/commitment-pooling";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import { expect, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../../shared/.storybook/adminFixtures";
import { FIXTURE_WORK_MEDIA } from "../../../../../../shared/.storybook/fixtures";
import {
  withAdminIdentity,
  withRouter,
  withSeededQueryClient,
} from "../../../../../../shared/.storybook/decorators";
import { POOL_STORY_SEEDS, STORY_GARDEN, storyCommitmentDialog } from "../poolStoryFixtures";
import { STORY_CYCLES } from "../poolStoryPools";
import { CommitmentDialogPanel } from "./index";

// The panel reads the commitment through the shared controller; the cache
// carries the detail, its timeline and its cycle so the real component renders
// over fixtures. A read left unseeded goes to the network, which the story gate
// refuses, and a failed cycle read turns the record into its error cast. Roles
// are chain reads, so the fixture viewer renders the bystander's detail: facts,
// roster and timeline without steward acts.
const dialog = storyCommitmentDialog();
const cycleId = dialog.commitment?.cycleId ?? 0n;
// The proof behind the record, as a gateway read returns it, so its photos and documents
// list in the dialog: one proof with a photo, a PDF and a Word file, one with a note.
const PROOF_CID = "bafy-story-dialog-proof";
const NOTE_PROOF_CID = "bafy-story-dialog-note";
const lead = dialog.commitment?.leadProvider ?? null;
const detail = dialog.detail
  ? {
      ...dialog.detail,
      evidenceAttributions: [
        { cid: PROOF_CID, contributor: lead, attacher: lead, createdAt: 1_700_000_000 },
        { cid: NOTE_PROOF_CID, contributor: lead, attacher: lead, createdAt: 1_699_900_000 },
      ],
    }
  : null;
const COMMITMENT_STORY_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  ...POOL_STORY_SEEDS,
  [queryKeys.commitmentPooling.commitment(DEFAULT_CHAIN_ID, 2n), detail],
  [
    queryKeys.commitmentPooling.evidence(PROOF_CID),
    parseCommitmentEvidenceDocument({
      version: 1,
      media: [{ cid: FIXTURE_WORK_MEDIA[0], mime: "image/jpeg", kind: "photo" }],
      documents: [
        {
          cid: "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy",
          mime: "application/pdf",
          name: "qa-report.pdf",
          size: 1024,
        },
        {
          cid: "bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq",
          mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          name: "qa-log.docx",
          size: 1024,
        },
      ],
    }),
  ],
  [
    queryKeys.commitmentPooling.evidence(NOTE_PROOF_CID),
    parseCommitmentEvidenceDocument({ version: 1, note: "Handles sanded and oiled." }),
  ],
  [
    queryKeys.commitmentPooling.activity(DEFAULT_CHAIN_ID, {
      chainId: DEFAULT_CHAIN_ID,
      commitmentId: 2n,
      limit: 50,
    }),
    dialog.events,
  ],
  [queryKeys.commitmentPooling.protocolPool(DEFAULT_CHAIN_ID), { poolId: null, rootGarden: null }],
  [
    queryKeys.commitmentPooling.cycle(DEFAULT_CHAIN_ID, cycleId),
    STORY_CYCLES.find((cycle) => cycle.cycleId === cycleId) ?? null,
  ],
];

const meta: Meta<typeof CommitmentDialogPanel> = {
  title: "Admin/Pool/CommitmentDialogPanel",
  component: CommitmentDialogPanel,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "W10, one commitment in the steward's dialect: chips, parties, lifecycle, facts, roster and timeline, with the acts the reader's authority and the record's state allow.",
      },
    },
  },
  args: { chainId: DEFAULT_CHAIN_ID, garden: STORY_GARDEN, commitmentId: "2", tone: "garden" },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(COMMITMENT_STORY_SEEDS),
    (Story) => (
      <div className="max-w-xl" data-tone="garden">
        <Story />
      </div>
    ),
    // The panel's state casts navigate (retry/back), so the story needs a
    // router — without one the Detail and NotFound stories crash on mount.
    withRouter(["/garden"]),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentDialogPanel>;

export const Detail: Story = {
  // In the story gate, so the cast that closes a commitment for good stays reviewable.
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Proof added")).toBeVisible();
    await expect(canvas.getByRole("link", { name: /qa-report\.pdf/ })).toBeVisible();
  },
};

export const NotFound: Story = {
  args: { commitmentId: "404" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/couldn’t be loaded/)).toBeVisible();
  },
};
