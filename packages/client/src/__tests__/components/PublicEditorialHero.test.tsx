import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// The hero only needs `cn` from the shared barrel; mocking the barrel keeps
// this suite off the wallet dependency graph (same pattern as fund.test.tsx).
vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

import { PublicEditorialHero } from "../../components/Public/PublicEditorialHero";

/**
 * The editorial hero plays its cinematic entrance on the arrival history
 * entry only. Replaying it on every in-app navigation made the hero card
 * blink during the `vt-header` shared-element morph: the incoming card sits
 * at opacity 0 through its animation delay while the browser cross-fades the
 * old hero into it. These tests pin the arrival-only latch.
 */

function HeroStage() {
  return (
    <>
      <Link to="/impact">Go to impact</Link>
      <Routes>
        <Route
          path="/gardens"
          element={
            <PublicEditorialHero
              variant="banner"
              imageSrc="/images/hero-garden.webp"
              titleId="gardens-hero-title"
              title="Gardens hero"
            />
          }
        />
        <Route
          path="/impact"
          element={
            <PublicEditorialHero
              variant="banner"
              imageSrc="/images/hero-impact.webp"
              titleId="impact-hero-title"
              title="Impact hero"
            />
          }
        />
      </Routes>
    </>
  );
}

function renderStage() {
  return render(
    <MemoryRouter initialEntries={["/gardens"]}>
      <HeroStage />
    </MemoryRouter>
  );
}

describe("PublicEditorialHero entrance animation", () => {
  it("animates on the arrival history entry", () => {
    const { container } = renderStage();

    expect(container.querySelector(".editorial-hero-in")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Gardens hero" })).toHaveClass(
      "editorial-fade-up-1"
    );
  });

  it("renders fully composed after an in-app navigation", async () => {
    const user = userEvent.setup();
    const { container } = renderStage();

    await user.click(screen.getByRole("link", { name: "Go to impact" }));

    const heading = screen.getByRole("heading", { name: "Impact hero" });
    expect(heading).toBeInTheDocument();
    expect(container.querySelector(".editorial-hero-in")).toBeNull();
    expect(heading).not.toHaveClass("editorial-fade-up-1");
  });
});
