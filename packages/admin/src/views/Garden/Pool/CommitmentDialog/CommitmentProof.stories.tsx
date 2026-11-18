import {
  type EvidenceAttributionRow,
  parseCommitmentEvidenceDocument,
} from "@green-goods/shared/commitment-pooling";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Meta, StoryObj } from "@storybook/react";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { expect, within } from "storybook/test";
import { FIXTURE_WORK_MEDIA } from "../../../../../../shared/.storybook/fixtures";
import { CommitmentProof } from "./CommitmentProof";

const LEAD = "0x1111111111111111111111111111111111111111" as const;

/** Proof documents as the installed app pins them, keyed by the CID each attachment names. */
const PROOF_DOCUMENTS: Record<string, Record<string, unknown> | null> = {
  "bafy-story-proof-documents": {
    version: 1,
    note: "Fence repaired and the gate rehung. The report and the work log are attached.",
    media: [
      { cid: FIXTURE_WORK_MEDIA[0], mime: "image/jpeg", kind: "photo" },
      { cid: FIXTURE_WORK_MEDIA[1], mime: "image/jpeg", kind: "photo" },
    ],
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
        name: "Riverside fence repair, volunteer log and signed sign-off sheet.docx",
        size: 1_258_291,
      },
    ],
    links: [{ url: "https://example.org/riverside/fence-repair", label: "Repair notes" }],
  },
  "bafy-story-proof-unreadable": null,
};

function proofRow(cid: string, createdAt: number): EvidenceAttributionRow {
  return { cid, contributor: LEAD, attacher: LEAD, createdAt };
}

/** Puts each proof document in the cache the view reads, as a gateway read would. */
function SeededProof({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  useState(() => {
    for (const [cid, document] of Object.entries(PROOF_DOCUMENTS)) {
      client.setQueryData(
        queryKeys.commitmentPooling.evidence(cid),
        document ? parseCommitmentEvidenceDocument(document) : null
      );
    }
    return null;
  });
  return <>{children}</>;
}

const meta: Meta<typeof CommitmentProof> = {
  title: "Admin/Pool/CommitmentProof",
  component: CommitmentProof,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "What a promise's proof holds, in the Hub's promise dialog: each proof's photos, voice notes and documents as the work view shows a work's, with its note, its links and who added it when. Each document opens from the gateway.",
      },
    },
  },
  decorators: [
    (Story) => (
      <SeededProof>
        <div className="max-w-md p-4" data-tone="garden">
          <Story />
        </div>
      </SeededProof>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentProof>;

/** A proof with photos, a PDF and a Word file, a note and a link. */
export const WithDocuments: Story = {
  args: {
    attributions: [proofRow("bafy-story-proof-documents", 1_700_000_000)],
    recordedCount: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: /qa-report\.pdf/ })).toBeVisible();
    await expect(canvas.getByRole("list", { name: "Documents" })).toBeVisible();
  },
};

/**
 * One proof reads, one cannot, and the chain counts a third the indexer has not listed:
 * each gap is said, never hidden behind a count.
 */
export const PartlyUnreadable: Story = {
  args: {
    attributions: [
      proofRow("bafy-story-proof-documents", 1_700_000_000),
      proofRow("bafy-story-proof-unreadable", 1_699_000_000),
    ],
    recordedCount: 3,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("This proof could not be read right now.")).toBeVisible();
    await expect(
      canvas.getByText("1 piece of proof is recorded but cannot be shown right now.")
    ).toBeVisible();
  },
};
