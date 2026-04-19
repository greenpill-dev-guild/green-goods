import { renderWithProviders as render, screen, userEvent } from "../test-utils";
import { describe, expect, it, vi } from "vitest";

import { MinimalWorkCard, WorkCard } from "../../components/Cards/Work/WorkCard";

describe("components/Cards/WorkCard", () => {
  const workItem = {
    id: "work-1",
    type: "work" as const,
    title: "Tree Planting",
    gardenId: "0x2222222222222222222222222222222222222222",
    gardenName: "Community Garden",
    status: "pending" as const,
    createdAt: Date.now() - 7_200_000,
    retryCount: 2,
    error: "Network timeout",
    size: 1_024_000,
    images: {
      count: 3,
      totalSize: 512_000,
    },
    mediaPreview: ["https://example.com/tree-planting.jpg"],
  };

  it("renders status, media count, retry state, and click behavior", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<WorkCard work={workItem} onClick={handleClick} />);

    const card = screen.getByRole("button");

    expect(screen.getByText("Tree Planting")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(card).toHaveTextContent("2 hours ago");
    expect(card).toHaveTextContent("Community Garden");
    expect(screen.getByText("Error loading work")).toBeInTheDocument();
    expect(card).toHaveTextContent("↻ 2");

    await user.click(card);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe("components/Cards/MinimalWorkCard", () => {
  const work = {
    id: "work-1",
    title: "Plant Flowers",
    actionUID: 1,
    gardenAddress: "0x2222222222222222222222222222222222222222",
    gardenerAddress: "0x1111111111111111111111111111111111111111",
    media: ["https://example.com/photo.jpg"],
    feedback: "Great work on the roses!",
    status: "approved",
    createdAt: Date.now() - 7_200_000,
    metadata: "",
  };

  it("renders action override, media count, feedback, and relative time", () => {
    render(<MinimalWorkCard work={work as any} onClick={vi.fn()} actionTitle="Custom Title" />);

    expect(screen.getByText("Custom Title")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Feedback")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
  });

  it("calls onClick when the compact card is pressed", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<MinimalWorkCard work={work as any} onClick={handleClick} />);

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
