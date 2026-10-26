import {
  type EvidenceAttributionRow,
  parseCommitmentEvidenceDocument,
} from "@green-goods/shared/commitment-pooling";
import {
  getTestQueryClient,
  resetTestQueryClient,
} from "@green-goods/shared/__tests__/test-utils/query-client";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { afterEach, describe, expect, it } from "vitest";
import { CommitmentEvidence } from "../../views/Home/Garden/Commitment/CommitmentEvidence";
import { renderWithProviders, screen } from "../test-utils";

const AMARA = "0x1111111111111111111111111111111111111111" as const;

/**
 * One proof on the promise, its document already read into the cache the page
 * reads through `useCommitmentEvidence`. A document that cannot be read is
 * cached as nothing, as the gateway leaves it.
 */
function proof(cid: string, document: Record<string, unknown> | null): EvidenceAttributionRow {
  getTestQueryClient().setQueryData(
    queryKeys.commitmentPooling.evidence(cid),
    document ? parseCommitmentEvidenceDocument({ version: 1, ...document }) : null
  );
  return { cid, contributor: AMARA, attacher: AMARA, createdAt: 1_700_000_000 };
}

/**
 * A proof whose document is still being read. The cache already holds a read
 * in flight that never settles, so the page joins it instead of fetching.
 */
function pendingProof(cid: string): EvidenceAttributionRow {
  getTestQueryClient()
    .fetchQuery({
      queryKey: queryKeys.commitmentPooling.evidence(cid),
      queryFn: () => new Promise<never>(() => undefined),
    })
    // Clearing the cache after the test cancels this read; nothing waits on it.
    .catch(() => undefined);
  return { cid, contributor: AMARA, attacher: AMARA, createdAt: 1_700_000_100 };
}

const NOTE = "Replaced the two split slats and rehung the gate.";
const REPAIR_NOTES = { url: "https://example.org/riverside/fence-repair", label: "Repair notes" };

afterEach(() => resetTestQueryClient());

describe("CommitmentEvidence", () => {
  it("shows the words of a proof that has only a note", () => {
    renderWithProviders(
      <CommitmentEvidence attributions={[proof("bafy-note", { note: NOTE })]} recordedCount={1} />
    );

    expect(screen.getByText(NOTE)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Submitted proof" })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/^Added /)).toBeInTheDocument();
  });

  it("opens each link of a proof that has only links, and stops counting them", () => {
    renderWithProviders(
      <CommitmentEvidence
        attributions={[
          proof("bafy-links", {
            links: [REPAIR_NOTES, { url: "https://example.org/riverside/photos" }],
          }),
        ]}
        recordedCount={1}
      />
    );

    const labelled = screen.getByRole("link", { name: "Repair notes" });
    expect(labelled).toHaveAttribute("href", REPAIR_NOTES.url);
    expect(labelled).toHaveAttribute("target", "_blank");
    // A link with no label is named by its address.
    expect(
      screen.getByRole("link", { name: "https://example.org/riverside/photos" })
    ).toHaveAttribute("href", "https://example.org/riverside/photos");
    expect(screen.queryByRole("list", { name: "Submitted proof" })).toBeNull();
    // The rows are the links, so the caption no longer counts them.
    expect(screen.getByText(/^Added /)).not.toHaveTextContent(/link/);
  });

  it("keeps the media tiles beside the note and the links", () => {
    renderWithProviders(
      <CommitmentEvidence
        attributions={[
          proof("bafy-full", {
            note: NOTE,
            links: [REPAIR_NOTES],
            media: [{ cid: "https://example.org/fence-after.jpg", mime: "image/jpeg" }],
            audio: [{ cid: "https://example.org/walkthrough.webm", durationSeconds: 24 }],
          }),
        ]}
        recordedCount={1}
      />
    );

    const tiles = screen.getByRole("list", { name: "Submitted proof" });
    expect(tiles).toContainElement(screen.getByRole("img", { name: "Proof photo 1" }));
    expect(tiles).toContainElement(screen.getByRole("button", { name: "Play voice note 1" }));
    expect(screen.getByText(NOTE)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Repair notes" })).toHaveAttribute(
      "href",
      REPAIR_NOTES.url
    );
  });

  it("keeps a read proof's note and links while another proof is still loading", () => {
    renderWithProviders(
      <CommitmentEvidence
        attributions={[
          proof("bafy-read", { note: NOTE, links: [REPAIR_NOTES] }),
          pendingProof("bafy-slow"),
        ]}
        recordedCount={2}
      />
    );

    expect(screen.getByText(NOTE)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Repair notes" })).toHaveAttribute(
      "href",
      REPAIR_NOTES.url
    );
    // Only the proof still loading says so.
    expect(screen.getByRole("status")).toHaveTextContent("Reading the proof");
  });

  it("says when recorded proof cannot be shown", () => {
    renderWithProviders(
      <CommitmentEvidence
        attributions={[proof("bafy-note", { note: NOTE }), proof("bafy-gone", null)]}
        recordedCount={3}
      />
    );

    expect(screen.getByText(NOTE)).toBeInTheDocument();
    expect(screen.getByText("This proof could not be read right now.")).toBeInTheDocument();
    expect(
      screen.getByText("1 piece of proof is recorded but cannot be shown right now.")
    ).toBeInTheDocument();
  });
});
