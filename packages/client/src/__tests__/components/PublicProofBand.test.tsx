/**
 * PublicProofBand empty + populated state tests.
 *
 * Locks the band's contract: six confirmed counts (what the listed Gardens have
 * documented, then what their members committed to). When every count is zero
 * the band shows one explanatory line instead of six "0"s that read as a broken
 * state; a count that could not be read is a dash, never zero; and the commitment
 * counts load on their own.
 *
 * @vitest-environment happy-dom
 */

import en from "@green-goods/shared/i18n/en.json";
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

import {
  PublicProofBand,
  type PublicProofBandProps,
} from "../../components/Public/PublicProofBand";

const LABELS = [
  en["public.home.proof.gardens"],
  en["public.home.proof.contributors"],
  en["public.home.proof.works"],
  en["public.home.proof.assessments"],
  en["public.pool.impact.made.label"],
  en["public.pool.impact.kept.label"],
];

const ZERO: PublicProofBandProps = {
  gardens: 0,
  contributors: 0,
  works: 0,
  assessments: 0,
  commitmentsMade: 0,
  commitmentsKept: 0,
};

function renderBand(props: PublicProofBandProps) {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        IntlProvider,
        { locale: "en", messages: en as Record<string, string> },
        createElement(PublicProofBand, props)
      )
    )
  );
}

/** Each marker's label paired with the figure printed above it. */
function figures() {
  return Array.from(document.querySelectorAll("dl > div")).map((marker) => [
    marker.querySelector("p:nth-of-type(2)")?.textContent,
    marker.querySelector("p:first-of-type")?.textContent,
  ]);
}

describe("PublicProofBand", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the record, then the commitments, in one band", () => {
    renderBand({
      gardens: 8,
      contributors: 41,
      works: 38,
      assessments: 2,
      commitmentsMade: 18,
      commitmentsKept: 2,
    });
    expect(figures()).toEqual([
      [LABELS[0], "8"],
      [LABELS[1], "41"],
      [LABELS[2], "38"],
      [LABELS[3], "2"],
      [LABELS[4], "18"],
      [LABELS[5], "2"],
    ]);
  });

  it("shows the single explanatory line when every count is zero", () => {
    renderBand(ZERO);
    expect(screen.getByText(en["public.home.proof.empty"])).toBeInTheDocument();
    for (const label of LABELS) expect(screen.queryByText(label)).toBeNull();
  });

  it("keeps the figures when only the commitments are non-zero", () => {
    renderBand({ ...ZERO, commitmentsMade: 3 });
    for (const label of LABELS) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(en["public.home.proof.empty"])).toBeNull();
  });

  it("dashes out a count that could not be read instead of publishing zero", () => {
    renderBand({
      gardens: 13,
      contributors: 40,
      works: null,
      assessments: 2,
      commitmentsMade: null,
      commitmentsKept: null,
    });
    expect(screen.getAllByText(en["public.impact.proof.unavailable"])).toHaveLength(3);
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByText(en["public.home.proof.empty"])).toBeNull();
  });

  it("holds every marker while either read is still loading, even when the counts are zero", () => {
    const { container } = renderBand({ ...ZERO, isCommitmentsLoading: true });
    for (const label of LABELS) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(en["public.home.proof.empty"])).toBeNull();
    // Only the two commitment figures wait; the record counts have settled.
    expect(container.querySelectorAll("[data-editorial-skeleton]")).toHaveLength(2);
  });
});
