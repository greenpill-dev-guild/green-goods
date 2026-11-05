import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionMenu } from "../../components/ActionMenu";

describe("ActionMenu", () => {
  it("has a named compact trigger and hides actions until opened", () => {
    render(
      <ActionMenu label="Garden Actions" actions={[{ label: "Leave Garden", onSelect: vi.fn() }]} />
    );
    expect(screen.getByRole("button", { name: "Garden Actions" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.queryByRole("button", { name: "Leave Garden" })).not.toBeInTheDocument();
  });
  it("opens and invokes a selected action exactly once", () => {
    const selected = vi.fn();
    render(
      <ActionMenu
        label="Garden Actions"
        actions={[{ label: "Leave Garden", onSelect: selected, danger: true }]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Garden Actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave Garden" }));
    expect(selected).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Garden Actions" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });
  it("does not invoke disabled actions", () => {
    const selected = vi.fn();
    render(
      <ActionMenu
        label="Garden Actions"
        actions={[{ label: "Leave Garden", onSelect: selected, disabled: true }]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Garden Actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave Garden" }));
    expect(selected).not.toHaveBeenCalled();
  });
  it("Escape dismisses the disclosure", () => {
    render(
      <ActionMenu label="Garden Actions" actions={[{ label: "Leave Garden", onSelect: vi.fn() }]} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Garden Actions" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Leave Garden" }), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Garden Actions" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });
});
