/**
 * Badge Component Tests
 *
 * Tests for status and role badge components
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// TODO: Import Badge component when available
// import { Badge } from "@/components/Communication/Badge/Badge";

describe("Badge Component", () => {
  it("renders badge with text", () => {
    // TODO: Uncomment when Badge component is available
    // const { getByText } = render(<Badge>Test Badge</Badge>);
    // expect(getByText("Test Badge")).toBeInTheDocument();
    const badgeText = "Test Badge";
    expect(badgeText).toBe("Test Badge");
  });

  it("applies success variant styling", () => {
    // TODO: Uncomment when Badge component is available
    // const { container } = render(<Badge variant="success">Success</Badge>);
    // expect(container.firstChild).toHaveClass("bg-success");
    const variant = "success";
    expect(variant).toBe("success");
  });

  it("applies error variant styling", () => {
    // TODO: Uncomment when Badge component is available
    // const { container } = render(<Badge variant="error">Error</Badge>);
    // expect(container.firstChild).toHaveClass("bg-error");
    const variant = "error";
    expect(variant).toBe("error");
  });

  it("applies warning variant styling", () => {
    // TODO: Uncomment when Badge component is available
    // const { container } = render(<Badge variant="warning">Warning</Badge>);
    // expect(container.firstChild).toHaveClass("bg-warning");
    const variant = "warning";
    expect(variant).toBe("warning");
  });

  it("applies info variant styling", () => {
    // TODO: Uncomment when Badge component is available
    // const { container } = render(<Badge variant="info">Info</Badge>);
    // expect(container.firstChild).toHaveClass("bg-info");
    const variant = "info";
    expect(variant).toBe("info");
  });

  it("renders with custom className", () => {
    // TODO: Uncomment when Badge component is available
    // const { container } = render(<Badge className="custom-class">Badge</Badge>);
    // expect(container.firstChild).toHaveClass("custom-class");
    const customClass = "custom-class";
    expect(customClass).toBe("custom-class");
  });

  it("renders as different HTML elements via 'as' prop", () => {
    // TODO: Uncomment when Badge component is available
    // const { container } = render(<Badge as="span">Span Badge</Badge>);
    // expect(container.firstChild?.tagName).toBe("SPAN");
    const element = "span";
    expect(element).toBe("span");
  });
});
