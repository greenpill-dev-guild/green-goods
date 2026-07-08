/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "../../test-utils";
import { PageHeader } from "@/components/Layout/PageHeader";

describe("PageHeader", () => {
  it("keeps sticky canvas headers transparent and borderless", () => {
    render(<PageHeader title="Hub" variant="canvas" sticky />);

    const header = screen.getByRole("banner");

    expect(header).toHaveClass("page-header-canvas-sticky", "sticky");
    expect(header).not.toHaveClass("border-b");
    expect(header).toHaveStyle({ background: "transparent" });
    expect(header.style.borderBottomColor).toBe("");
  });
});
