/** @vitest-environment happy-dom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountBadge } from "../../components/Badge/Badge";

describe("CountBadge", () => {
  it("renders nothing below one, so no consumer shows an empty capsule", () => {
    const { container } = render(
      <>
        <CountBadge count={0} />
        <CountBadge count={-3} />
      </>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    { count: 1, max: undefined, text: "1" },
    { count: 99, max: undefined, text: "99" },
    { count: 100, max: undefined, text: "99+" },
    { count: 9, max: 9, text: "9" },
    { count: 10, max: 9, text: "9+" },
  ])("shows $count as $text with a cap of $max", ({ count, max, text }) => {
    render(<CountBadge count={count} max={max} data-testid="badge" />);
    expect(screen.getByTestId("badge")).toHaveTextContent(text);
  });

  it("draws the surface ring only when the badge sits on an icon", () => {
    render(
      <>
        <CountBadge count={3} data-testid="beside-label" />
        <CountBadge count={3} ring data-testid="on-icon" />
      </>
    );
    expect(screen.getByTestId("beside-label")).not.toHaveAttribute("data-ring");
    expect(screen.getByTestId("on-icon")).toHaveAttribute("data-ring");
  });

  it("keeps the owner's attributes, such as a test id and a hidden badge", () => {
    render(<CountBadge count={12} aria-hidden="true" className="absolute" data-testid="badge" />);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("gg-count-badge", "absolute");
    expect(badge).toHaveAttribute("aria-hidden", "true");
  });
});
