/**
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  EditorialListRowSkeleton,
  EditorialMediaCardSkeleton,
  EditorialSkeleton,
  EditorialStatSkeleton,
} from "../../components/Public/atoms/EditorialSkeleton";

describe("EditorialSkeleton", () => {
  it("is always decorative and exposes a stable test marker", () => {
    const { container } = render(<EditorialSkeleton className="h-4 w-20" />);
    const skeleton = container.querySelector("[data-editorial-skeleton]");

    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton).toHaveClass("editorial-skeleton", "h-4", "w-20");
    expect(skeleton).not.toHaveAttribute("role");
  });

  it("provides media, row, and stat compositions without accessible content", () => {
    const { container } = render(
      <div>
        <EditorialMediaCardSkeleton />
        <EditorialListRowSkeleton />
        <EditorialStatSkeleton />
      </div>
    );

    expect(
      container.querySelector("[data-editorial-skeleton-layout='media-card']")
    ).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("[data-editorial-skeleton-layout='list-row']")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(container.querySelectorAll("[data-editorial-skeleton]").length).toBeGreaterThanOrEqual(
      8
    );
  });

  it("makes the tonal sweep static when reduced motion is requested", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/editorial.css"), "utf8");
    const reducedMotionRule = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/
    )?.[1];

    expect(reducedMotionRule).toContain(".editorial-skeleton::after");
    expect(reducedMotionRule).toContain("animation: none");
  });
});
