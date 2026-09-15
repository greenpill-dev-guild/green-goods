/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SheetHeading } from "../../components/Dialog/SheetHeading";

describe("SheetHeading (DL-028)", () => {
  it("renders an h3 carrying the shared body heading style", () => {
    render(<SheetHeading className="mb-3">Domains</SheetHeading>);
    const heading = screen.getByRole("heading", { level: 3, name: "Domains" });
    expect(heading).toHaveAttribute("data-component", "SheetHeading");
    expect(heading).toHaveClass("mb-3");
  });

  it("renders the element a group needs, such as a label for a control", () => {
    render(
      <>
        <SheetHeading as="label" htmlFor="note">
          Note
        </SheetHeading>
        <textarea id="note" />
        <SheetHeading as="h4" title="Green Goods Community Garden">
          Green Goods Community Garden
        </SheetHeading>
      </>
    );
    expect(screen.getByRole("textbox", { name: "Note" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4 })).toHaveAttribute(
      "title",
      "Green Goods Community Garden"
    );
  });
});
