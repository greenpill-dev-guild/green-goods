/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SheetActions } from "../../components/Dialog/SheetActions";

const bar = () => document.querySelector('[data-component="SheetActions"]');
const actionRoles = () =>
  Array.from(bar()?.querySelectorAll("button") ?? []).map((button) =>
    button.getAttribute("data-action")
  );

describe("SheetActions", () => {
  it("renders nothing without an action", () => {
    render(<SheetActions />);
    expect(bar()).toBeNull();
  });

  it("stacks primary, secondary, then tertiary in reading order (DL-016)", () => {
    render(
      <SheetActions
        primary={{ label: "Confirm It Was Kept" }}
        secondary={{ label: "Not Yet" }}
        tertiary={{ label: "Discard Draft", tone: "danger" }}
      />
    );
    expect(bar()).toHaveAttribute("data-layout", "stack");
    expect(actionRoles()).toEqual(["primary", "secondary", "tertiary"]);
    expect(screen.getByRole("button", { name: "Confirm It Was Kept" })).toHaveClass(
      "gg-button-primary"
    );
    expect(screen.getByRole("button", { name: "Not Yet" })).toHaveClass("gg-button-secondary");
    const tertiary = screen.getByRole("button", { name: "Discard Draft" });
    expect(tertiary).toHaveClass("gg-button-ghost");
    expect(tertiary).toHaveAttribute("data-tone", "danger");
  });

  it("puts Back before Continue for step navigation", () => {
    render(
      <SheetActions layout="steps" primary={{ label: "Continue" }} secondary={{ label: "Back" }} />
    );
    expect(bar()).toHaveAttribute("data-layout", "steps");
    expect(actionRoles()).toEqual(["secondary", "primary"]);
  });

  it("fills a destructive primary with the error color and outlines a destructive secondary", () => {
    render(
      <SheetActions
        primary={{ label: "Delete", tone: "danger" }}
        secondary={{ label: "Remove Photo", tone: "danger" }}
      />
    );
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("gg-button-danger");
    const secondary = screen.getByRole("button", { name: "Remove Photo" });
    expect(secondary).toHaveClass("gg-button-secondary");
    expect(secondary).toHaveAttribute("data-tone", "danger");
  });

  it("keeps a loading action focusable but inert", () => {
    const onClick = vi.fn();
    render(<SheetActions primary={{ label: "Send", loading: true, onClick }} />);
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).not.toBeDisabled();
    expect(send).toHaveAttribute("aria-disabled", "true");
    expect(send).toHaveAttribute("aria-busy", "true");
    send.focus();
    expect(send).toHaveFocus();
    fireEvent.click(send);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disables a plain disabled action natively", () => {
    const onClick = vi.fn();
    render(<SheetActions secondary={{ label: "Reset Filters", disabled: true, onClick }} />);
    const reset = screen.getByRole("button", { name: "Reset Filters" });
    expect(reset).toBeDisabled();
    expect(reset).toHaveAttribute("aria-disabled", "true");
  });

  it("submits a form from outside it, and never while loading", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const view = render(
      <>
        <form id="join-request" onSubmit={onSubmit} />
        <SheetActions primary={{ label: "Send Request", type: "submit", form: "join-request" }} />
      </>
    );
    const send = screen.getByRole("button", { name: "Send Request" });
    expect(send).toHaveAttribute("type", "submit");
    fireEvent.click(send);
    expect(onSubmit).toHaveBeenCalledOnce();

    view.rerender(
      <>
        <form id="join-request" onSubmit={onSubmit} />
        <SheetActions
          primary={{ label: "Send Request", type: "submit", form: "join-request", loading: true }}
        />
      </>
    );
    fireEvent.click(screen.getByRole("button", { name: "Send Request" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("defaults to plain buttons and pads the safe area only when asked", () => {
    const view = render(<SheetActions primary={{ label: "Deposit" }} />);
    expect(screen.getByRole("button", { name: "Deposit" })).toHaveAttribute("type", "button");
    expect(bar()).not.toHaveAttribute("data-safe-area");

    view.rerender(<SheetActions primary={{ label: "Deposit" }} safeArea />);
    expect(bar()).toHaveAttribute("data-safe-area");
  });
});
