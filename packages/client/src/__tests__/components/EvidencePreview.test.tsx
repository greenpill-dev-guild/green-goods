import type { ResolvedEvidence } from "@green-goods/shared/commitment-pooling";
import { describe, expect, it } from "vitest";
import { EvidencePreview } from "../../views/Home/Garden/Commitment/EvidencePreview";
import { renderWithProviders, screen, within } from "../test-utils";

const CONTRIBUTOR = "0x1111111111111111111111111111111111111111" as const;

function evidence(overrides: Partial<ResolvedEvidence> = {}): ResolvedEvidence {
  return {
    cid: "bafy-proof",
    contributor: CONTRIBUTOR,
    attacher: CONTRIBUTOR,
    createdAt: 1_700_000_000,
    document: { version: 1, note: "Planted the north bed" },
    isLoading: false,
    mediaUrls: [],
    audioUrls: [],
    ...overrides,
  };
}

describe("EvidencePreview", () => {
  it("renders the empty state", () => {
    renderWithProviders(<EvidencePreview evidence={[]} isLoading={false} />);
    expect(screen.getByText("No proof has been attached yet.")).toBeInTheDocument();
  });

  it.each([
    ["the row", evidence({ isLoading: true })],
    ["the collection", evidence()],
  ])("shows a loading status from %s", (_source, item) => {
    renderWithProviders(<EvidencePreview evidence={[item]} isLoading={!item.isLoading} />);
    expect(screen.getByRole("status")).toHaveTextContent("Reading the proof");
  });

  it("reports an unreadable document", () => {
    renderWithProviders(
      <EvidencePreview evidence={[evidence({ document: null })]} isLoading={false} />
    );
    expect(screen.getByText("This proof could not be read right now.")).toBeInTheDocument();
  });

  it("renders note, photo, video, audio, link, contributor, and date evidence", () => {
    renderWithProviders(
      <EvidencePreview
        isLoading={false}
        evidence={[
          evidence({
            document: {
              version: 1,
              note: "Planted the north bed",
              media: [
                { cid: "photo", mime: "image/jpeg", kind: "photo" },
                { cid: "video", mime: "video/mp4", kind: "video" },
              ],
              audio: [{ cid: "audio", mime: "audio/webm" }],
              links: [{ url: "https://example.com/report", label: "Field report" }],
            },
            mediaUrls: ["https://example.com/photo.jpg", "https://example.com/video.mp4"],
            audioUrls: ["https://example.com/audio.webm"],
          }),
        ]}
      />
    );

    const list = screen.getByRole("list", { name: "Submitted proof" });
    expect(within(list).getByText("Planted the north bed")).toBeInTheDocument();
    expect(within(list).getByRole("img", { name: "Proof photo 1" })).toHaveAttribute(
      "src",
      "https://example.com/photo.jpg"
    );
    expect(list.querySelector("video")).toHaveAttribute("src", "https://example.com/video.mp4");
    expect(within(list).getByLabelText("Voice note 1")).toHaveAttribute(
      "src",
      "https://example.com/audio.webm"
    );
    expect(within(list).getByRole("link", { name: "Field report" })).toHaveAttribute(
      "href",
      "https://example.com/report"
    );
    expect(within(list).getByText("Nov 14, 2023")).toBeInTheDocument();
  });
});
