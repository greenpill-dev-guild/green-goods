import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared", async () => {
  const React = await import("react");
  return {
    cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "),
    ActionBannerFallback: ({ title }: { title: string }) =>
      React.createElement("div", { "data-testid": "action-banner-fallback" }, title),
    ImageWithFallback: ({
      alt,
      className,
      src,
    }: {
      alt?: string;
      className?: string;
      src?: string;
    }) => React.createElement("img", { alt, className, src }),
  };
});

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

  it("reserves three guidance lines in selection cards", () => {
    render(<ActionCard action={action as any} selected={false} media="small" height="selection" />);

    expect(screen.getByTestId("action-card").className).toContain("h-[13.25rem]");
    expect(screen.getByText("Take photos of your planting work").className).toContain(
      "line-clamp-3"
    );
  });

  it("uses the design-system label token for action titles", () => {
    render(<ActionCard action={action as any} selected={false} media="small" height="selection" />);

    expect(screen.getByText("Plant Trees").className).toContain("text-label-md");
  });

  it("calls onClick when the card is pressed", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<ActionCard action={action as any} selected={false} onClick={handleClick} />);

    await user.click(screen.getByText("Plant Trees"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
