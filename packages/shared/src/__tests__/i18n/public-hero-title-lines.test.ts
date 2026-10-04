import { describe, expect, it } from "vitest";
import en from "../../i18n/en.json";

/**
 * The public site's home page and the four pages in its navigation open on a hero title that
 * runs three lines on phones, tablets and desktop. The hero card's measure cannot promise that:
 * dropping a closing period let "regenerative work" fit on one line and took the Actions title
 * from three lines to two. So each English title is written as three `<line>` segments, which
 * the views render one per line. A copy edit that drops or regroups them fails here.
 *
 * Spanish and Portuguese titles are longer and wrap on their own.
 */
describe("the core public pages' hero titles", () => {
  it.each([
    ["public.home.hero.title"],
    ["public.gardens.heroTitle"],
    ["public.impact.heroTitle"],
    ["public.fund.heroTitle"],
    ["public.actions.heroTitle"],
  ])("%s is written as three lines with no words outside them", (key) => {
    const title = (en as Record<string, string>)[key];

    expect(title.match(/<line>/g) ?? []).toHaveLength(3);
    expect(title.replace(/<line>.*?<\/line>/g, "").trim()).toBe("");
  });
});
