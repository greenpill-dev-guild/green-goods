import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ defaultMessage }: { defaultMessage?: string }) => defaultMessage ?? "",
  }),
}));

vi.mock("@green-goods/shared", () => ({
  formatTimeSpent: (minutes: number) => `${minutes} minutes`,
}));

vi.mock("@/components/Features/Work", () => ({
  WorkView: ({
    details,
    title,
  }: {
    title: string;
    details: Array<{ label: string; value: string }>;
  }) =>
    createElement(
      "div",
      null,
      createElement("h1", null, title),
      details.map((detail) =>
        createElement(
          "div",
          { key: detail.label, "data-testid": `detail-${detail.label}` },
          `${detail.label}: ${detail.value}`
        )
      )
    ),
}));

import { WorkViewSection } from "../../views/Home/Garden/WorkViewSection";

const mockGarden = {
  id: "0xGarden",
  chainId: 11155111,
  tokenAddress: "0xToken",
  tokenID: 1n,
  name: "Garden",
  description: "Garden description",
  location: "Austin",
  bannerImage: "",
  gardeners: [],
  operators: [],
  evaluators: [],
  owners: [],
  funders: [],
  communities: [],
  assessments: [],
  works: [],
  createdAt: Date.now(),
};

const mockWork = {
  id: "0xWork",
  title: "Work",
  actionUID: 1,
  gardenerAddress: "0xGardener",
  gardenAddress: "0xGarden",
  feedback: "Observed healthy growth",
  metadata: "bafyMetadata",
  media: [],
  createdAt: Date.now(),
  status: "pending" as const,
};

describe("WorkViewSection", () => {
  it("renders a fallback detail when metadata is unavailable", () => {
    render(
      createElement(WorkViewSection, {
        garden: mockGarden as any,
        work: mockWork,
        workMetadata: null,
        viewingMode: "viewer",
        actionTitle: "Plant trees",
        effectiveStatus: "pending",
        onDownloadData: vi.fn(),
        onShare: vi.fn(),
      })
    );

    expect(screen.getByTestId("detail-Details")).toHaveTextContent("Details: Not available");
    expect(screen.getByTestId("detail-Description")).toHaveTextContent(
      "Description: Observed healthy growth"
    );
  });

  it("falls back safely when metadata has an unknown shape", () => {
    render(
      createElement(WorkViewSection, {
        garden: mockGarden as any,
        work: mockWork,
        workMetadata: {
          notes: "Windy morning",
          nested: { count: 2 },
          tags: ["wind", "soil"],
        },
        viewingMode: "viewer",
        actionTitle: "Plant trees",
        effectiveStatus: "pending",
        onDownloadData: vi.fn(),
        onShare: vi.fn(),
      })
    );

    expect(screen.getByTestId("detail-Details")).toHaveTextContent("Details: Not available");
    expect(screen.queryByTestId("detail-Notes")).not.toBeInTheDocument();
  });
});
