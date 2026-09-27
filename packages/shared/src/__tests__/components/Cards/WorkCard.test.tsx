/**
 * WorkCard Tests
 * @vitest-environment jsdom
 *
 * The card's title is display only: it never shows the timestamps older submissions appended.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkCard } from "../../../components/Cards/WorkCard/WorkCard";

describe("WorkCard", () => {
  it("titles a hosted work without the timestamps appended to its stored title", () => {
    render(
      <WorkCard
        work={{
          id: "work-1",
          title: "Planting Event - 2026-03-04T22:38:24.283Z - 2026-03-04T22:38:24.331Z",
          status: "pending",
          createdAt: Date.now(),
        }}
      />
    );

    const title = screen.getByRole("heading", { level: 4 });
    expect(title).toHaveTextContent(/^Planting Event$/);
    expect(title).toHaveAttribute("title", "Planting Event");
  });
});
