/**
 * The commitment screens' chrome: the detail and compose shells pin their top
 * nav and bar to the viewport, as the work view does, so neither depends on a
 * height the garden route hands down. Adding evidence draws the one submission
 * flow's page (DL-131), Submit Work's bar and all.
 *
 * @vitest-environment happy-dom
 */
import type { SubmissionFlowController } from "@green-goods/shared/hooks/client-ui/submission/useSubmissionFlowController";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { SubmissionFlow } from "../../components/Features/Work";

import { CommitmentDetailShell } from "../../views/Home/Garden/Commitment/CommitmentDetailShell";
import { ComposeShell } from "../../views/Home/Garden/Compose/ComposeShell";
import { renderWithProviders, screen } from "../test-utils";

const noop = () => undefined;
/** The evidence kind on Media, as the flow hands it to the shell. */
const evidenceOnMedia: SubmissionFlowController = {
  kind: "evidence",
  stages: ["start", "media", "details", "review"],
  stage: "media",
  progress: 2,
  stageLabelIds: [
    "app.work.step.start",
    "app.work.step.media",
    "app.work.step.details",
    "app.work.step.review",
  ],
  goToStage: noop,
  back: noop,
  forward: {
    labelId: "app.proof.next.details",
    disabled: false,
    loading: false,
    blockedReasonId: null,
    takeUpPrompts: null,
    run: noop,
  },
  mediaTools: null,
  promise: { pinned: null, open: false, show: noop, hide: noop },
};
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
    expect(screen.getByText("Body").parentElement).toHaveClass("pt-[var(--app-top-bar-height)]");
    expect(document.querySelector("[data-component='FixedBarSpacer']")).not.toBeNull();
  });

  it("pins the submission flow's top nav and bar for either kind, and keeps its stage clear", () => {
    renderWithProviders(
      <SubmissionFlow flow={evidenceOnMedia} keepFormStill renderStage={() => <p>Body</p>} />
    );

    expect(screen.getByRole("button", { name: "Go back" }).closest(".fixed")).not.toBeNull();
    const bar = screen
      .getByRole("button", { name: "Details" })
      .closest("[data-component='FlowBar']");
    expect(bar).toHaveClass("fixed", "bottom-0", "left-0");
    expect(screen.getByText("Body").closest("form")).toHaveClass("pt-[var(--app-top-bar-height)]");
    expect(screen.getByText("Body").parentElement?.className).toContain("pb-[calc(7rem");
  });

  it("keeps the stage clear of a taller bar while a dependent link is scheduled", () => {
    renderWithProviders(
      <SubmissionFlow flow={evidenceOnMedia} tallBar renderStage={() => <p>Body</p>} />
    );

    expect(screen.getByText("Body").parentElement?.className).toContain("pb-[calc(14rem");
  });

  it("draws no bar or spacer when the screen has no act", () => {
    renderWithProviders(shells[0][1]());

    expect(document.querySelector("[data-component='FixedBar']")).toBeNull();
    expect(document.querySelector("[data-component='FixedBarSpacer']")).toBeNull();
  });
});
