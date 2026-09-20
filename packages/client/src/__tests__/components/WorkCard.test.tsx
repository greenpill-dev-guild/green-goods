import { describe, expect, it, vi } from "vitest";
import { MinimalWorkCard } from "../../components/Cards/Work/WorkCard";
import { renderWithProviders as render, screen, userEvent } from "../test-utils";

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

  it("keeps the compact row and its media square on the same height contract", () => {
    render(<MinimalWorkCard work={work as any} onClick={vi.fn()} />);

    const card = screen.getByRole("button");
    const image = card.querySelector("img");
    const media = image?.parentElement;

    expect(card).toHaveStyle({ height: "88px" });
    expect(media).toHaveStyle({ height: "100%", aspectRatio: "1 / 1" });
  });

  it("uses one primary state and supporting line for a queued card", () => {
    render(
      <MinimalWorkCard
        work={work as any}
        onClick={vi.fn()}
        presentation={{
          statusLabel: "To upload",
          statusTone: "uploading",
          contextLabel: "You submitted",
          supportingText: "Ready to sign and upload",
        }}
      />
    );

    const card = screen.getByRole("button");
    expect(screen.getByText("To upload")).toBeInTheDocument();
    expect(screen.queryByText("Approved")).not.toBeInTheDocument();
    expect(screen.getByText("Ready to sign and upload")).toBeInTheDocument();
    expect(card.querySelectorAll("h4")).toHaveLength(1);
  });
});
