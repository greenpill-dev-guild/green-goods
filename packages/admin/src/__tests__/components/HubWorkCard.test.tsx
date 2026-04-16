/**
 * HubWorkCard Component Tests
 * @vitest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { Domain, type Work } from "@green-goods/shared";
import { describe, expect, it, vi } from "vitest";
import { HubWorkCard } from "@/views/Hub/components/HubWorkCard";

// Wrap in IntlProvider for formatMessage
import { IntlProvider } from "react-intl";
import en from "@green-goods/shared/i18n/en.json";

function renderCard(props: Partial<React.ComponentProps<typeof HubWorkCard>> = {}) {
  const defaultWork: Work = {
    id: "0x123",
    title: "Planted 50 native saplings",
    actionUID: 1,
    gardenerAddress: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
    gardenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
    feedback: "Great work",
    metadata: "{}",
    media: ["ipfs://QmPhoto1", "ipfs://QmPhoto2", "ipfs://QmPhoto3"],
    createdAt: Date.now() / 1000 - 3600, // 1 hour ago
    status: "pending",
  };

  return render(
    <IntlProvider locale="en" messages={en}>
      <HubWorkCard
        work={defaultWork}
        actionDomain={Domain.AGRO}
        gardenName="Milpa Alta"
        gardenerDisplayName="0x1234...5678"
        {...props}
      />
    </IntlProvider>
  );
}

describe("HubWorkCard", () => {
  it("renders the work title", () => {
    renderCard();
    expect(screen.getByText("Planted 50 native saplings")).toBeInTheDocument();
  });

  it("renders gardener name and garden name in metadata", () => {
    renderCard();
    expect(screen.getByText(/0x1234...5678/)).toBeInTheDocument();
    expect(screen.getByText(/Milpa Alta/)).toBeInTheDocument();
  });

  it("renders domain badge for AGRO", () => {
    renderCard({ actionDomain: Domain.AGRO });
    // AGRO domain label from i18n
    expect(screen.getByText(/Agro/i)).toBeInTheDocument();
  });

  it("hides domain badge when actionDomain is undefined", () => {
    renderCard({ actionDomain: undefined });
    expect(screen.queryByText(/Agro|Solar|Education|Waste/i)).not.toBeInTheDocument();
  });

  it("renders media count badge when 2+ images", () => {
    renderCard();
    // 3 media items → "1 / 3"
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("does not render media count badge for single image", () => {
    renderCard({
      work: {
        id: "0x456",
        title: "Single photo",
        actionUID: 1,
        gardenerAddress: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
        gardenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        feedback: "",
        metadata: "{}",
        media: ["ipfs://QmPhoto1"],
        createdAt: Date.now() / 1000,
        status: "pending",
      },
    });
    expect(screen.queryByText(/1 \/ 1/)).not.toBeInTheDocument();
  });

  it("renders fallback gradient when no images", () => {
    const { container } = renderCard({
      work: {
        id: "0x789",
        title: "No photos",
        actionUID: 1,
        gardenerAddress: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
        gardenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        feedback: "",
        metadata: "{}",
        media: [],
        createdAt: Date.now() / 1000,
        status: "pending",
      },
    });
    // Should render gradient fallback (no <img> elements)
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    renderCard({ onClick });
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is a native button element (handles Enter/Space natively)", () => {
    renderCard();
    const card = screen.getByRole("button");
    expect(card.tagName).toBe("BUTTON");
  });

  it("has the title attribute for text overflow accessibility", () => {
    renderCard();
    const titleEl = screen.getByText("Planted 50 native saplings");
    expect(titleEl).toHaveAttribute("title", "Planted 50 native saplings");
  });

  it("renders with correct card shape classes", () => {
    renderCard();
    expect(screen.getByRole("button").className).toContain("rounded-xl");
  });

  it("is focusable (native button)", () => {
    renderCard();
    const card = screen.getByRole("button");
    expect(card.tagName).toBe("BUTTON");
  });
});
