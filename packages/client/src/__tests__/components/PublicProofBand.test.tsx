/**
 * PublicProofBand empty + populated state tests.
 *
 * Locks the Phase 2 P2-4 contract: when the four homepage stats are all zero
 * the band shows a single explanatory line instead of four "0"s that read as
 * a broken state. When any stat is non-zero or loading, the four numerals
 * render as before.
 *
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  useInViewReveal: () => ({ ref: () => undefined, revealed: true }),
}));

import { PublicProofBand } from "../../components/Public/PublicProofBand";

const messages: Record<string, string> = {
  "public.home.proof.kicker": "§ 02: Living Public Record",
  "public.home.proof.title": "Quantifiable restoration.",
  "public.home.proof.body":
    "This isn't a dashboard. These are confirmed counts: gardens attended, hands at work, entries logged, assessments held. Public, verifiable.",
  "public.home.proof.cta": "View public evidence",
  "public.home.proof.emptyKicker": "Reading the record",
  "public.home.proof.empty":
    "The first records will appear here as Gardens publish their work, season by season.",
  "public.home.proof.gardens": "Gardens attended",
  "public.home.proof.gardensNote": "Active places under continuous documentation.",
  "public.home.proof.contributors": "Hands at work",
  "public.home.proof.contributorsNote": "Gardeners with a role in at least one Garden.",
  "public.home.proof.works": "Entries logged",
  "public.home.proof.worksNote": "Panel checks, soil cores, workshop notes.",
  "public.home.proof.assessments": "Assessments held",
  "public.home.proof.assessmentsNote": "Independent evaluator confirmations.",
};

function renderBand(props: {
  gardens: number;
  contributors: number;
  works: number;
  assessments: number;
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
    expect(screen.queryByText("Gardens attended")).toBeNull();
    expect(screen.queryByText("Hands at work")).toBeNull();
    expect(screen.queryByText("Entries logged")).toBeNull();
    expect(screen.queryByText("Assessments held")).toBeNull();
  });

  it("shows the four markers when any count is non-zero", () => {
    renderBand({ gardens: 13, contributors: 0, works: 0, assessments: 0 });
    expect(screen.getByText("Gardens attended")).toBeInTheDocument();
    expect(screen.getByText("Hands at work")).toBeInTheDocument();
    expect(screen.getByText("Entries logged")).toBeInTheDocument();
    expect(screen.getByText("Assessments held")).toBeInTheDocument();
    expect(screen.queryByText(/first records will appear here/)).toBeNull();
  });

  it("shows the four markers while loading even when counts are zero", () => {
    renderBand({ gardens: 0, contributors: 0, works: 0, assessments: 0, isLoading: true });
    expect(screen.getByText("Gardens attended")).toBeInTheDocument();
    expect(screen.queryByText(/first records will appear here/)).toBeNull();
  });
});
