/**
 * The state block (`EmptyState`): each surface passes its own action, so the
 * shared Button never renders in the cockpit (Rule 18); a failure is announced
 * and a calm state is not; and a page can name itself by the state's title.
 *
 * @vitest-environment happy-dom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EmptyState, type EmptyStateTone } from "../../components/ListPrimitives";

afterEach(cleanup);

describe("EmptyState", () => {
  it("renders a surface's own action as given, without the shared Button", () => {
    render(
      <EmptyState
        icon={<span />}
        title="No actions yet"
        action={
          <button type="button" data-component="AdminButton">
            Create Your First Action
          </button>
        }
      />
    );

    const button = screen.getByRole("button", { name: "Create Your First Action" });
    expect(button).toHaveAttribute("data-component", "AdminButton");
    expect(document.querySelectorAll(".gg-button")).toHaveLength(0);
  });

  it("renders no action slot when there is no action", () => {
    render(<EmptyState icon={<span />} title="Nothing here" action={null} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each<[EmptyStateTone, boolean]>([
    ["error", true],
    ["warning", false],
    ["neutral", false],
  ])("announces a %s state: %s", (tone, announced) => {
    render(<EmptyState tone={tone} icon={<span />} title="Couldn't load promises" />);

    if (announced) {
      expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load promises");
    } else {
      expect(screen.queryByRole("alert")).toBeNull();
    }
  });

  it("announces a loading block politely, as the spinner it replaces did", () => {
    render(<EmptyState busy icon={<span />} title="Loading your work..." />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading your work...");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("lets a page name itself by the title and focus it, never from the Tab key", () => {
    render(
      <EmptyState titleAs="h1" headingId="page-title" icon={<span />} title="This link expired" />
    );

    const heading = screen.getByRole("heading", { level: 1, name: "This link expired" });
    expect(heading).toHaveAttribute("id", "page-title");
    expect(heading).toHaveAttribute("tabindex", "-1");
    heading.focus();
    expect(heading).toHaveFocus();
  });

  it("draws no tile when a state has no icon", () => {
    const { container } = render(<EmptyState icon={undefined} title="Nothing here" />);

    expect(container.querySelector('[data-slot="icon"]')).toBeNull();
    expect(screen.getByRole("heading", { level: 3, name: "Nothing here" })).toBeInTheDocument();
  });
});
