/**
 * WorkReview Component Tests
 *
 * Tests the review step of the work submission flow: displays garden/action info,
 * generates media URLs for images, renders audio notes, and shows dynamic details.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Track calls to mediaResourceManager and AudioPlayer
const mockGetOrCreateUrl = vi.fn((file: File, trackingId: string) => `blob:mock-${file.name}`);

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    mediaResourceManager: {
      getOrCreateUrl: (...args: unknown[]) => mockGetOrCreateUrl(...(args as [File, string])),
      cleanupUrls: vi.fn(),
    },
    AudioPlayer: ({ file }: { file: File }) =>
      createElement("div", { "data-testid": `audio-player-${file.name}` }, file.name),
  };
});

// Mock WorkView to expose the props it receives for assertion
vi.mock("@/components/Features/Work", () => ({
  WorkView: ({
    title,
    info,
    garden,
    actionTitle,
    media,
    details,
  }: {
    title: string;
    info: string;
    garden?: { name: string };
    actionTitle: string;
    media?: string[];
    details: Array<{ label: string; value: string }>;
  }) =>
    createElement("div", { "data-testid": "work-view" }, [
      createElement("span", { key: "title", "data-testid": "review-title" }, title),
      createElement("span", { key: "info", "data-testid": "review-info" }, info),
      createElement("span", { key: "garden", "data-testid": "review-garden" }, garden?.name),
      createElement("span", { key: "action", "data-testid": "review-action" }, actionTitle),
      createElement(
        "span",
        { key: "media-count", "data-testid": "review-media-count" },
        String(media?.length ?? 0)
      ),
      createElement(
        "div",
        { key: "details", "data-testid": "review-details" },
        details.map((d, i) =>
          createElement(
            "div",
            { key: i, "data-testid": `detail-${d.label}` },
            `${d.label}: ${d.value}`
          )
        )
      ),
    ]),
}));

// Import after mocks
import type { Action, Address, Garden } from "@green-goods/shared";
import { Domain } from "@green-goods/shared";
import { WorkReview } from "../../views/Garden/Review";

const messages: Record<string, string> = {
  "app.garden.review.title": "Review Work",
  "app.garden.submit.tab.review.instruction": "Check if the information is correct",
  "app.garden.review.timeSpent": "Time Spent",
  "app.garden.review.description": "Description",
  "app.garden.review.audioNotes": "Audio Notes",
  "app.garden.review.video": "Video",
};

const now = Date.now();

const baseGarden: Garden = {
  id: "0x1234" as Address,
  chainId: 11155111,
  tokenAddress: "0x0000000000000000000000000000000000000001" as Address,
  tokenID: BigInt(1),
  name: "Sunny Garden",
  description: "",
  location: "Bogota",
  bannerImage: "",
  gardeners: [],
  operators: [],
  evaluators: [],
  owners: [],
  funders: [],
  communities: [],
  assessments: [],
  works: [],
  createdAt: now,
};

const baseAction: Action = {
  id: "action-1",
  slug: "plant-trees",
  title: "Plant Trees",
  description: "Plant native trees",
  domain: Domain.AGRO,
  startTime: now - 86400000,
  endTime: now + 86400000,
  capitals: [],
  media: ["/trees.jpg"],
  createdAt: now,
  inputs: [
    {
      key: "treeCount",
      title: "Trees Planted",
      placeholder: "",
      type: "number" as const,
      required: true,
      options: [],
    },
  ],
};

function renderReview(props: Partial<React.ComponentProps<typeof WorkReview>> = {}) {
  const defaultProps: React.ComponentProps<typeof WorkReview> = {
    garden: baseGarden,
    action: baseAction,
    images: [],
    values: {},
    feedback: "",
    ...props,
  };

  return render(
    createElement(IntlProvider, { locale: "en", messages }, createElement(WorkReview, defaultProps))
  );
}

describe("WorkReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders garden name and action title via WorkView", () => {
    renderReview();

    expect(screen.getByTestId("review-garden")).toHaveTextContent("Sunny Garden");
    expect(screen.getByTestId("review-action")).toHaveTextContent("Plant Trees");
  });

  it("displays review title and description", () => {
    renderReview();

    expect(screen.getByTestId("review-title")).toHaveTextContent("Review Work");
    expect(screen.getByTestId("review-info")).toHaveTextContent(
      "Check if the information is correct"
    );
  });

  it("generates media URLs for photo files via mediaResourceManager", () => {
    const photo1 = new File(["img1"], "photo1.jpg", { type: "image/jpeg" });
    const photo2 = new File(["img2"], "photo2.jpg", { type: "image/jpeg" });

    renderReview({ images: [photo1, photo2] });

    expect(mockGetOrCreateUrl).toHaveBeenCalledTimes(2);
    expect(mockGetOrCreateUrl).toHaveBeenCalledWith(photo1, "work-draft");
    expect(mockGetOrCreateUrl).toHaveBeenCalledWith(photo2, "work-draft");
    expect(screen.getByTestId("review-media-count")).toHaveTextContent("2");
  });

  it("displays dynamic details from action inputs and values", () => {
    renderReview({
      values: { treeCount: 15 },
      timeSpentMinutes: 90,
      feedback: "Good progress today",
    });

    // Time spent should be formatted (90 min -> "1h 30m")
    expect(screen.getByTestId("detail-Time Spent")).toHaveTextContent("1h 30m");
    // Dynamic field from action inputs
    expect(screen.getByTestId("detail-Trees Planted")).toHaveTextContent("15");
    // Feedback shown as Description
    expect(screen.getByTestId("detail-Description")).toHaveTextContent("Good progress today");
  });

  it("renders audio note players when audioNotes are provided", () => {
    const audioFile = new File(["audio"], "note.webm", { type: "audio/webm" });

    renderReview({ audioNotes: [audioFile] });

    expect(screen.getByTestId("audio-player-note.webm")).toBeInTheDocument();
    expect(screen.getByText("Audio Notes")).toBeInTheDocument();
  });
});
