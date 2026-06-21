/**
 * MetaStrip Tests
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetaStrip } from "../../../components/Canvas/MetaStrip";

describe("MetaStrip", () => {
  it("renders inline metadata items", () => {
    render(
      <MetaStrip
        density="inline"
        items={[
          { id: "total", value: "12", label: "total" },
          { id: "domains", value: "3", label: "domains" },
        ]}
      />
    );

    const strip = screen.getByText("total").closest('[data-component="MetaStrip"]');
    expect(strip).toHaveAttribute("data-density", "inline");
    expect(strip).not.toHaveAttribute("data-state", "loading");
  });

  it("renders an inline loading row with the same density hook and item count", () => {
    const { container } = render(
      <MetaStrip density="inline" items={[]} loading loadingItemCount={2} />
    );

    const strip = container.querySelector('[data-component="MetaStrip"]');
    expect(strip).toHaveAttribute("data-density", "inline");
    expect(strip).toHaveAttribute("data-state", "loading");
    expect(strip).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll('[data-slot="skeleton-item"]')).toHaveLength(2);
  });

  it("renders a pill loading row with the same density hook and item count", () => {
    const { container } = render(
      <MetaStrip density="pill" items={[]} loading loadingItemCount={3} />
    );

    const strip = container.querySelector('[data-component="MetaStrip"]');
    expect(strip).toHaveAttribute("data-density", "pill");
    expect(strip).toHaveAttribute("data-state", "loading");
    expect(container.querySelectorAll('[data-slot="skeleton-item"]')).toHaveLength(3);
  });
});
