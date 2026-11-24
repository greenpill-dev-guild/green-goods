/**
 * MediaCard Tests
 * @vitest-environment happy-dom
 *
 * The card shape for an object with a picture of its own: what it opens, which
 * layout it draws, the marks on its picture, and the line that keeps a list of
 * stacked cards one height.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaCard, type MediaCardProps } from "../../../components/Cards/MediaCard";

const TITLE = "Planted 50 native saplings along the ridge";

function renderCard(props: Partial<MediaCardProps> = {}) {
  return render(
    <MediaCard
      media={<img src="photo.jpg" alt="" />}
      title={TITLE}
      status={<span>Approved</span>}
      details="maria.eth"
      detailsEnd="2 hr. ago"
      {...props}
    />
  );
}

describe("MediaCard", () => {
  it("is one native button that opens its object, and no button when it opens nothing", () => {
    const onClick = vi.fn();
    const { unmount } = renderCard({ onClick });
    const card = screen.getByRole("button", { name: new RegExp(TITLE) });
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
    unmount();

    renderCard();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("draws the shared card surface, stacked unless asked to lie wide", () => {
    const { container, rerender } = renderCard();
    const card = container.firstElementChild;
    expect(card).toHaveClass("gg-card");
    expect(card).toHaveAttribute("data-layout", "stacked");

    rerender(<MediaCard media={null} title={TITLE} layout="wide" selected />);
    expect(container.firstElementChild).toHaveAttribute("data-layout", "wide");
    expect(container.firstElementChild).toHaveAttribute("data-selected", "true");
  });

  it("shows a one-line title with the full title on hover, and only the marks it is given", () => {
    renderCard({ mediaLabel: "Agroforestry" });
    expect(screen.getByRole("heading", { name: TITLE })).toHaveAttribute("title", TITLE);
    expect(screen.getByText("Agroforestry")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });

  it.each([
    { layout: "stacked", subtitle: "", keepsLine: true },
    { layout: "wide", subtitle: "", keepsLine: false },
    { layout: "stacked", subtitle: undefined, keepsLine: false },
  ] as const)("a $layout card with subtitle $subtitle keeps an empty line: $keepsLine", ({
    layout,
    subtitle,
    keepsLine,
  }) => {
    const { container } = renderCard({ layout, subtitle });
    // The kept line is empty, so it is hidden from assistive technology.
    expect(container.querySelectorAll('p[aria-hidden="true"]')).toHaveLength(keepsLine ? 1 : 0);
  });

  it("shows a given line under the status with its text on hover", () => {
    renderCard({ layout: "wide", subtitle: "Planting event" });
    expect(screen.getByText("Planting event")).toHaveAttribute("title", "Planting event");
  });
});
