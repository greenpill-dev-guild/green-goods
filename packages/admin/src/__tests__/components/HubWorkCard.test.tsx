/**
 * HubWorkCard Component Tests
 * @vitest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { Domain, type Work } from "@green-goods/shared/types/domain";
import { describe, expect, it, vi } from "vitest";
import { HubWorkCard } from "@/views/Hub/components/HubWorkCard";

// Wrap in IntlProvider for formatMessage
import { IntlProvider } from "react-intl";
import en from "@green-goods/shared/i18n/en.json";
import es from "@green-goods/shared/i18n/es.json";
import pt from "@green-goods/shared/i18n/pt.json";

const MESSAGES: Record<string, Record<string, string>> = { en, es, pt };

function renderCard(
  props: Partial<React.ComponentProps<typeof HubWorkCard>> = {},
  locale: "en" | "es" | "pt" = "en"
) {
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
    <IntlProvider locale={locale} messages={MESSAGES[locale]}>
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

  it("renders gardener name in metadata, garden name only in hover-title", () => {
    // Per Rule 17, garden name is declared by AppBar GardenChip — the card body
    // does not redeclare it. The hover-title preserves the gardener+garden context
    // for accessibility / detached contexts (PDF, screenshot share).
    renderCard();
    expect(screen.getByText(/0x1234...5678/)).toBeInTheDocument();
    expect(screen.queryByText(/^Milpa Alta$/)).not.toBeInTheDocument();
    const tooltipHost = screen.getByText(/0x1234...5678/).closest('[title*="Milpa Alta"]');
    expect(tooltipHost).not.toBeNull();
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

  it("renders the work state without duplicating the stage action label", () => {
    renderCard({ statusLabel: "Pending" });
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.queryByText("Review")).not.toBeInTheDocument();
  });

  it("renders a friendly relative timestamp instead of an ISO timestamp", () => {
    const { container } = renderCard({
      work: {
        id: "0xdate",
        title: "Friendly date",
        actionUID: 1,
        gardenerAddress: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
        gardenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        feedback: "",
        metadata: "{}",
        media: [],
        // 26 hours before "now" — the 1a meta row shows relative age ("1d ago").
        createdAt: Date.now() / 1000 - 26 * 60 * 60,
        status: "pending",
      },
    });

    expect(screen.getByText(/ago$/)).toBeInTheDocument();
    expect(container.textContent).not.toContain("T12:34:00.000Z");
  });

  it("localizes the relative timestamp and keeps the exact time available", () => {
    const createdAt = Date.now() / 1000 - 26 * 60 * 60;
    const work: Work = {
      id: "0xlocale",
      title: "Trabajo localizado",
      actionUID: 1,
      gardenerAddress: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
      gardenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
      feedback: "",
      metadata: "{}",
      media: [],
      createdAt,
      status: "pending",
    };

    const { container } = renderCard({ work }, "es");

    // Regression guard: the card used to render hardcoded English through the
    // shared formatRelativeTime, so es/pt operators saw "1 day ago".
    const time = container.querySelector("time");
    expect(time).not.toBeNull();
    expect(time?.textContent ?? "").not.toMatch(/ago$/);
    expect(time?.textContent ?? "").toMatch(/hace/i);

    // The relative value is lossy, so the exact submission time stays reachable
    // as a machine-readable attribute and a hover title.
    expect(time?.getAttribute("dateTime")).toBe(new Date(createdAt * 1000).toISOString());
    expect(time?.getAttribute("title") ?? "").not.toBe("");
  });

  it("shows the action title when it differs from the work title", () => {
    // The Hub queue search matches on the action title (filterPendingWorks /
    // filterAssessmentQueue), so a hover-only title would render a search hit
    // with no visible matching text.
    renderCard({ actionTitle: "Compost rotation" });

    expect(screen.getByText("Compost rotation")).toBeInTheDocument();
  });

  it("does not repeat the action title when the work title already carries it", () => {
    renderCard({
      actionTitle: "Community Cleanup",
      work: {
        id: "0xsame-title",
        title: "Community Cleanup",
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

    expect(screen.getAllByText("Community Cleanup")).toHaveLength(1);
  });

  it("strips generated ISO timestamp suffixes from legacy work titles", () => {
    const { container } = renderCard({
      actionTitle: "Community Cleanup",
      work: {
        id: "0xgenerated-title",
        title: "Community Cleanup - 2026-07-08T12:34:00.000Z",
        actionUID: 1,
        gardenerAddress: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
        gardenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        feedback: "",
        metadata: "{}",
        media: [],
        createdAt: new Date("2026-07-08T12:34:00Z").getTime() / 1000,
        status: "pending",
      },
    });

    expect(screen.getByRole("heading", { name: "Community Cleanup" })).toBeInTheDocument();
    expect(screen.getAllByText("Community Cleanup")).toHaveLength(1);
    expect(container.textContent).not.toContain("2026-07-08T12:34:00.000Z");
  });

  it("localizes generated infrastructure milestone titles in Portuguese", () => {
    const actionTimestamp = "2026-07-07T16:36:37.231Z";
    const workTimestamp = "2026-07-07T16:36:37.366Z";
    const { container } = renderCard(
      {
        actionTitle: `Infrastructure Milestone - ${actionTimestamp}`,
        work: {
          id: "0xmilestone",
          title: `Infrastructure Milestone - ${actionTimestamp} - ${workTimestamp}`,
          actionUID: 1,
          gardenerAddress: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
          gardenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
          feedback: "",
          metadata: "{}",
          media: [],
          createdAt: new Date(workTimestamp).getTime() / 1000,
          status: "pending",
        },
      },
      "pt"
    );

    expect(
      screen.getByRole("heading", {
        name: `Marco de infraestrutura - ${actionTimestamp}`,
      })
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain("Infrastructure Milestone");
    expect(container.textContent).not.toContain(workTimestamp);
  });

  it("does not scale images on hover", () => {
    const { container } = renderCard();
    const image = container.querySelector("img");
    expect(image?.className).not.toContain("scale");
  });

  it("uses a flush card density so media reaches the card edge", () => {
    renderCard();
    expect(screen.getByRole("button").className).toContain("p-0");
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
    expect(screen.getByRole("button").className).toContain("rounded-[var(--m3-shape-md)]");
  });

  it("is focusable (native button)", () => {
    renderCard();
    const card = screen.getByRole("button");
    expect(card.tagName).toBe("BUTTON");
  });
});
