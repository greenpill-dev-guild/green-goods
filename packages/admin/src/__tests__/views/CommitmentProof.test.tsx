/**
 * @vitest-environment happy-dom
 */

import {
  type EvidenceAttributionRow,
  parseCommitmentEvidenceDocument,
} from "@green-goods/shared/commitment-pooling";
import {
  getTestQueryClient,
  resetTestQueryClient,
} from "@green-goods/shared/__tests__/test-utils/query-client";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommitmentProof } from "@/views/Garden/Pool/CommitmentDialog/CommitmentProof";
import { fireEvent, renderWithProviders, screen, within } from "../test-utils";

// The caption names who added the proof; ENS resolution has its own coverage.
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
}));

const LEAD = "0x1111111111111111111111111111111111111111" as const;
const PDF_CID = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
const WORD_CID = "bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq";
const PHOTO_CID = "bafkreidivzimqfqtoqxkrpge6bjyhlvxqs3rhe73owtmdulaxr5do5in7u";

/** One proof, its document already read into the cache the view reads through. */
function proof(cid: string, document: Record<string, unknown> | null): EvidenceAttributionRow {
  getTestQueryClient().setQueryData(
    queryKeys.commitmentPooling.evidence(cid),
    document ? parseCommitmentEvidenceDocument({ version: 1, ...document }) : null
  );
  return { cid, contributor: LEAD, attacher: LEAD, createdAt: 1_700_000_000 };
}

afterEach(() => resetTestQueryClient());

describe("CommitmentProof", () => {
  it("lists a proof's documents with their type and size, and its photos", () => {
    renderWithProviders(
      <CommitmentProof
        attributions={[
          proof("bafy-proof-documents", {
            media: [{ cid: PHOTO_CID, mime: "image/jpeg", kind: "photo" }],
            documents: [
              { cid: PDF_CID, mime: "application/pdf", name: "qa-report.pdf", size: 1024 },
              {
                cid: WORD_CID,
                mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                name: "qa-log.docx",
                size: 1024,
              },
            ],
          }),
        ]}
        recordedCount={1}
      />
    );

    const proofSection = screen.getByRole("region", { name: "Proof" });
    const documents = within(proofSection).getByRole("list", { name: "Documents" });
    const rows = within(documents).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("qa-report.pdf");
    expect(rows[0]).toHaveTextContent("PDF document · 1 kB");
    expect(rows[1]).toHaveTextContent("qa-log.docx");
    expect(rows[1]).toHaveTextContent("Word document · 1 kB");
    expect(within(proofSection).getByRole("button", { name: "Proof photo 1" })).toBeVisible();
  });

  it("opens each document from the gateway in a new tab, and a photo large", () => {
    renderWithProviders(
      <CommitmentProof
        attributions={[
          proof("bafy-proof-open", {
            media: [{ cid: PHOTO_CID, mime: "image/jpeg", kind: "photo" }],
            documents: [{ cid: PDF_CID, mime: "application/pdf", name: "qa-report.pdf" }],
          }),
        ]}
        recordedCount={1}
      />
    );

    const link = screen.getByRole("link", { name: /qa-report\.pdf/ });
    expect(link).toHaveAttribute("href", resolveIPFSUrl(PDF_CID));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    fireEvent.click(screen.getByRole("button", { name: "Proof photo 1" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps photos apart from a video beside them, and opens the proof's links", () => {
    const VIDEO_CID = "bafkreia5cufmf2fjxzhr6vjz4qxmhbq6k7a3d2etm6zkqbqpl7xbbzrxse";
    renderWithProviders(
      <CommitmentProof
        attributions={[
          proof("bafy-proof-mixed", {
            media: [
              { cid: VIDEO_CID, mime: "video/mp4", kind: "video" },
              { cid: PHOTO_CID, mime: "image/jpeg", kind: "photo" },
            ],
            links: [{ url: "https://example.org/riverside/fence-repair", label: "Repair notes" }],
          }),
        ]}
        recordedCount={1}
      />
    );

    // The video plays where it is; only the photo is a tile, so the grid opens no video.
    const video = document.querySelector("video");
    expect(video).toHaveAttribute("src", resolveIPFSUrl(VIDEO_CID));
    expect(screen.getAllByRole("button", { name: /^Proof photo/ })).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Proof photo 1" }).getAttribute("src")).toContain(
      PHOTO_CID
    );
    expect(screen.getByRole("link", { name: "Repair notes" })).toHaveAttribute(
      "href",
      "https://example.org/riverside/fence-repair"
    );
  });

  it("renders nothing for a promise with no proof", () => {
    const { container } = renderWithProviders(
      <CommitmentProof attributions={[]} recordedCount={0} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("says when a proof cannot be read, and keeps the ones that can", () => {
    renderWithProviders(
      <CommitmentProof
        attributions={[
          proof("bafy-proof-read", { note: "Planted twelve seedlings." }),
          proof("bafy-proof-gone", null),
        ]}
        recordedCount={3}
      />
    );

    expect(screen.getByText("Planted twelve seedlings.")).toBeInTheDocument();
    expect(screen.getByText("This proof could not be read right now.")).toBeInTheDocument();
    // The chain counts a third the indexer has not listed.
    expect(
      screen.getByText("1 piece of proof is recorded but cannot be shown right now.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Documents" })).toBeNull();
  });
});
