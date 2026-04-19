import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActionCard } from "../../components/Cards/Action/ActionCard";

describe("components/Cards/ActionCard", () => {
  const action = {
    id: "action-1",
    title: "Plant Trees",
    description: "Help plant trees in the community garden",
    media: ["https://example.com/tree.jpg"],
    mediaInfo: {
      description: "Take photos of your planting work",
    },
    startTime: Date.now() - 86_400_000,
    endTime: Date.now() + 86_400_000,
    capitals: ["LIVING"],
    createdAt: Date.now(),
  };

  it("renders the action title and media guidance", () => {
    render(<ActionCard action={action as any} selected={false} />);

    expect(screen.getByText("Plant Trees")).toBeInTheDocument();
    expect(screen.getByText("Take photos of your planting work")).toBeInTheDocument();
  });

  it("calls onClick when the card is pressed", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<ActionCard action={action as any} selected={false} onClick={handleClick} />);

    await user.click(screen.getByText("Plant Trees"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
