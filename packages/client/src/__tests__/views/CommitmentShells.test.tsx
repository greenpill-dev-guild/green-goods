/**
 * The commitment screens' chrome: the detail, proof and compose shells pin
 * their top nav and bar to the viewport, as the work view does, so neither
 * depends on a height the garden route hands down.
 *
 * @vitest-environment jsdom
 */
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { CommitmentDetailShell } from "../../views/Home/Garden/Commitment/CommitmentDetailShell";
import { ComposeShell } from "../../views/Home/Garden/Compose/ComposeShell";
import { ProofShell } from "../../views/Home/Garden/Proof/ProofShell";
import { renderWithProviders, screen } from "../test-utils";

const noop = () => undefined;
const shells: Array<[string, (bar?: ReactNode) => ReactElement]> = [
  [
    "detail",
    (bar) => (
      <CommitmentDetailShell onBack={noop} title="Prune the north beds" bar={bar}>
        <p>Body</p>
      </CommitmentDetailShell>
    ),
  ],
  [
    "proof",
    (bar) => (
      <ProofShell onBack={noop} progress={1} bar={bar}>
        <p>Body</p>
      </ProofShell>
    ),
  ],
  [
    "compose",
    (bar) => (
      <ComposeShell onBack={noop} title="Offer help" progress={1} bar={bar}>
        <p>Body</p>
      </ComposeShell>
    ),
  ],
];

describe("the commitment screens' chrome", () => {
  it.each(
    shells
  )("pins the %s screen's top nav and bar, and keeps its body clear of both", (_name, shell) => {
    renderWithProviders(shell(<button type="button">Act</button>));

    expect(screen.getByRole("button", { name: "Go back" }).closest(".fixed")).not.toBeNull();
    const bar = screen.getByRole("button", { name: "Act" }).closest("[data-component='FixedBar']");
    expect(bar).toHaveClass("fixed", "bottom-0", "left-0", "right-0");
    // The body starts below the top nav, and a spacer holds its end above the bar.
    expect(screen.getByText("Body").parentElement).toHaveClass("pt-20");
    expect(document.querySelector("[data-component='FixedBarSpacer']")).not.toBeNull();
  });

  it("draws no bar or spacer when the screen has no act", () => {
    renderWithProviders(shells[0][1]());

    expect(document.querySelector("[data-component='FixedBar']")).toBeNull();
    expect(document.querySelector("[data-component='FixedBarSpacer']")).toBeNull();
  });
});
