/**
 * WorkCard Tests
 * @vitest-environment happy-dom
 *
 * The card's title is display only: it never shows the timestamps older submissions appended.
 * Its age reads in the reader's language.
 */

import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";
import { WorkCard } from "../../../components/Cards/WorkCard/WorkCard";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

describe("WorkCard", () => {
  it("titles a hosted work without the timestamps appended to its stored title", () => {
    render(
      <IntlProvider locale="en">
        <WorkCard
          work={{
            id: "work-1",
            title: "Planting Event - 2026-03-04T22:38:24.283Z - 2026-03-04T22:38:24.331Z",
            status: "pending",
            createdAt: Date.now(),
          }}
        />
      </IntlProvider>
    );

    const title = screen.getByRole("heading", { level: 4 });
    expect(title).toHaveTextContent(/^Planting Event$/);
    expect(title).toHaveAttribute("title", "Planting Event");
  });

  it.each([
    ["es", "hace 2 horas"],
    ["pt", "há 2 horas"],
  ])("gives the work's age in the reader's language (%s)", (locale, age) => {
    render(
      <IntlProvider locale={locale}>
        <WorkCard
          work={{
            id: "work-1",
            title: "Planting Event",
            status: "pending",
            createdAt: Date.now() - TWO_HOURS_MS,
          }}
        />
      </IntlProvider>
    );

    expect(screen.getByText(age)).toBeInTheDocument();
  });
});
