/**
 * EmptyState action contract: a client caller passes shared Button props with a
 * label, and a surface with its own button family (admin) passes a ready
 * element, so the shared Button never renders there (Rule 18).
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmptyState } from "../../components/ListPrimitives";

afterEach(cleanup);

describe("EmptyState action", () => {
  it("renders Button props as the shared small Button with its label", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={<span />}
        title="No gardeners yet"
        action={{ label: "Invite Gardener", emphasis: "secondary", onClick }}
      />
    );

    const button = screen.getByRole("button", { name: "Invite Gardener" });
    expect(button).toHaveClass("gg-button");
    expect(button).toHaveAttribute("data-size", "sm");
    expect(button).toHaveAttribute("data-emphasis", "secondary");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders a ready element as given, without wrapping it in the shared Button", () => {
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
    expect(button).not.toHaveClass("gg-button");
    expect(document.querySelectorAll(".gg-button")).toHaveLength(0);
  });

  it("renders no action slot when there is no action", () => {
    render(<EmptyState icon={<span />} title="Nothing here" action={null} />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
