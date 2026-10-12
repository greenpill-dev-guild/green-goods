/**
 * PublicProofBand empty + populated state tests.
 *
 * Locks the Phase 2 P2-4 contract: when the four homepage stats are all zero
 * the band shows a single explanatory line instead of four "0"s that read as
 * a broken state. When any stat is non-zero or loading, the four numerals
 * render as before.
 *
 * @vitest-environment happy-dom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/hooks/ui/useInViewReveal", () => ({
  useInViewReveal: () => ({ ref: () => undefined, revealed: true }),
}));

import { PublicProofBand } from "../../components/Public/PublicProofBand";

const messages: Record<string, string> = {
  "public.home.proof.kicker": "§ 02: Living Public Record",
  "public.home.proof.title": "The public record so far.",
  "public.home.proof.body":
    "These counts show documented activity across the Gardens listed here. Steward approval confirms a work submission was reviewed; environmental outcomes need their own measurements and assessments.",
  "public.home.proof.cta": "View Public Evidence",
  "public.home.proof.emptyKicker": "Reading the record",
  "public.home.proof.empty":
    "The first records will appear here as Gardens publish their work, season by season.",
  "public.home.proof.gardens": "Gardens with approved work",
  "public.home.proof.gardensNote": "At least one steward-approved submission. No recency cutoff.",
  "public.home.proof.contributors": "Garden members",
  "public.home.proof.contributorsNote":
    "Gardeners and stewards in listed Gardens, with each account counted once.",
  "public.home.proof.works": "Approved submissions",
  "public.home.proof.worksNote": "Work documented by participants and reviewed by Garden stewards.",
  "public.home.proof.assessments": "Assessments recorded",
  "public.home.proof.assessmentsNote":
    "Records describing starting conditions, evidence standards, or progress.",
  "public.impact.proof.unavailable": "Not available right now",
};

function renderBand(props: {
  gardens: number | null;
  contributors: number | null;
  works: number | null;
  assessments: number | null;
  isLoading?: boolean;
}) {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(IntlProvider, { locale: "en", messages }, createElement(PublicProofBand, props))
    )
  );
}

describe("PublicProofBand", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the single explanatory line when every count is zero", () => {
    renderBand({ gardens: 0, contributors: 0, works: 0, assessments: 0 });
    expect(
      screen.getByText(
        "The first records will appear here as Gardens publish their work, season by season."
      )
    ).toBeInTheDocument();
    // None of the four-marker labels should be rendered when the band is empty.
    expect(screen.queryByText("Gardens with approved work")).toBeNull();
    expect(screen.queryByText("Garden members")).toBeNull();
    expect(screen.queryByText("Approved submissions")).toBeNull();
    expect(screen.queryByText("Assessments recorded")).toBeNull();
  });

  it("shows the four markers when any count is non-zero", () => {
    renderBand({ gardens: 13, contributors: 0, works: 0, assessments: 0 });
    expect(screen.getByText("Gardens with approved work")).toBeInTheDocument();
    expect(screen.getByText("Garden members")).toBeInTheDocument();
    expect(screen.getByText("Approved submissions")).toBeInTheDocument();
    expect(screen.getByText("Assessments recorded")).toBeInTheDocument();
    expect(screen.queryByText(/first records will appear here/)).toBeNull();
  });

  it("dashes out a count that could not be read instead of publishing zero", () => {
    renderBand({ gardens: 13, contributors: 40, works: null, assessments: 2 });
    expect(screen.getByText("Approved submissions")).toBeInTheDocument();
    expect(screen.getByText("Not available right now")).toBeInTheDocument();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByText(/first records will appear here/)).toBeNull();
  });

  it("shows the four markers while loading even when counts are zero", () => {
    const { container } = renderBand({
      gardens: 0,
      contributors: 0,
      works: 0,
      assessments: 0,
      isLoading: true,
    });
    expect(screen.getByText("Gardens with approved work")).toBeInTheDocument();
    expect(screen.queryByText(/first records will appear here/)).toBeNull();
    expect(container.querySelectorAll("[data-editorial-skeleton]")).toHaveLength(4);
    expect(screen.queryByText("...")).not.toBeInTheDocument();
  });
});
