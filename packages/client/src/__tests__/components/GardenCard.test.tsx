import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";

import { GardenCard } from "../../components/Cards/Garden/GardenCard";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <IntlProvider locale="en" messages={{}}>
      {children}
    </IntlProvider>
  );
}

describe("components/Cards/GardenCard", () => {
  const garden = {
    id: "0xGarden123",
    chainId: 11_155_111,
    tokenAddress: "0xToken456",
    tokenID: 1n,
    name: "Community Garden",
    description: "A beautiful community garden in the city center",
    location: "San Francisco, CA",
    bannerImage: "https://example.com/garden.jpg",
    gardeners: ["0xGardener1", "0xGardener2", "0xGardener3"],
    operators: ["0xOperator1"],
    createdAt: Date.now(),
  };

  it("renders core garden metadata", () => {
    render(
      <Wrapper>
        <GardenCard garden={garden as any} selected={false} />
      </Wrapper>
    );

    expect(screen.getByText("Community Garden")).toBeInTheDocument();
    expect(screen.getByText("San Francisco, CA")).toBeInTheDocument();
    expect(screen.getByText(/4\s+Members/)).toBeInTheDocument();
    expect(screen.getByText(/1\s+Operators/)).toBeInTheDocument();
    expect(screen.getByText("A beautiful community garden in the city center")).toBeInTheDocument();
  });

  it("passes click and selected state through to the shared card", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <Wrapper>
        <GardenCard garden={garden as any} selected={true} onClick={handleClick} />
      </Wrapper>
    );

    const card = screen.getByTestId("garden-card");
    const selectedOverlay = card.querySelector(".opacity-100");
    expect(container.querySelector("[data-selected='true']")).toBeInTheDocument();
    expect(card).toHaveStyle({ width: "100%" });
    expect(selectedOverlay?.getAttribute("style")).toContain("--color-primary");
    await user.click(screen.getByText("Community Garden"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("supports minimal selection cards that match action-card density", () => {
    render(
      <Wrapper>
        <GardenCard
          garden={garden as any}
          media="small"
          height="selection"
          showStats={false}
          showOperators={false}
        />
      </Wrapper>
    );

    expect(screen.getByTestId("garden-card").className).toContain("h-[13.25rem]");
    expect(screen.getByText("Community Garden").className).toContain("text-label-md");
    expect(screen.getByText("A beautiful community garden in the city center").className).toContain(
      "h-[3.75rem]"
    );
    expect(screen.queryByText("San Francisco, CA")).not.toBeInTheDocument();
    expect(screen.queryByText(/Members/)).not.toBeInTheDocument();
  });
});
