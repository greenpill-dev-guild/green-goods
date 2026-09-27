/**
 * StatusBadge Tests
 *
 * `variant` selects the generic badge's colour pair and its icon. Status
 * indicators must not rely on colour alone (WCAG 1.4.1), so each tone is
 * asserted through both channels.
 *
 * @vitest-environment jsdom
 */

import { RiCloseLine, RiTimeLine } from "@remixicon/react";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "../../components/StatusBadge";
import en from "../../i18n/en.json";

function renderBadge(badge: ReactElement): HTMLElement {
  const { container } = render(
    <IntlProvider locale="en" messages={en}>
      {badge}
    </IntlProvider>
  );
  const element = container.querySelector<HTMLElement>('[role="status"]');
  if (!element) throw new Error("StatusBadge rendered no status element");
  return element;
}

/** Remix icons carry no name in the DOM, so compare their path data. */
function iconPathOf(root: Element): string | null {
  return root.querySelector("svg path")?.getAttribute("d") ?? null;
}

describe("StatusBadge", () => {
  it('renders the error tone and its icon for variant="error"', () => {
    const badge = renderBadge(<StatusBadge variant="error">Failed to send</StatusBadge>);

    expect(badge).toHaveClass("bg-error-lighter", "text-error-dark", "border-error-light");
    expect(badge).not.toHaveClass("bg-bg-soft", "text-text-sub", "border-stroke-soft");
    expect(badge).toHaveTextContent("Failed to send");
    expect(iconPathOf(badge)).toBe(iconPathOf(render(<RiCloseLine />).container));
    expect(badge).not.toHaveAttribute("variant");
  });

  it("falls back to the neutral tone when no variant is given", () => {
    const badge = renderBadge(<StatusBadge>Draft</StatusBadge>);

    expect(badge).toHaveClass("bg-bg-soft", "text-text-sub", "border-stroke-soft");
    expect(badge).toHaveTextContent("Draft");
    expect(iconPathOf(badge)).toBe(iconPathOf(render(<RiTimeLine />).container));
  });

  it("still renders work statuses, whose variant selects the token set", () => {
    const badge = renderBadge(<StatusBadge status="rejected" variant="semantic" />);

    expect(badge).toHaveClass("bg-error-lighter", "text-error-dark", "border-error-light");
    expect(badge).toHaveTextContent("Rejected");
  });
});
