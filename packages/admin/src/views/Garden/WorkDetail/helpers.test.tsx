/**
 * @vitest-environment jsdom
 */

import enMessages from "@green-goods/shared/i18n/en";
import type { Work } from "@green-goods/shared/types/domain";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";
import { ReviewSummary } from "./helpers";

const reviewed = (overrides: Partial<Work>): Work =>
  ({
    id: "0xwork",
    title: "Planting Event",
    actionUID: 1,
    gardenerAddress: "0x68a6fe4e0b1e0e5d4a3bbf1a9ad5e6c1d9e8f207",
    gardenAddress: "0x0a1b2c3d4e5f60718293a4b5c6d7e8f901234567",
    feedback: "",
    metadata: "{}",
    media: [],
    createdAt: 1_700_000_000,
    status: "rejected",
    ...overrides,
  }) as Work;

function renderSummary(work: Work) {
  render(
    <IntlProvider locale="en" messages={enMessages}>
      <ReviewSummary work={work} />
    </IntlProvider>
  );
}

describe("ReviewSummary", () => {
  it("shows a rejection's reason as the feedback the gardener reads", () => {
    renderSummary(reviewed({ reviewFeedback: "Photos show a different site" }));

    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Feedback to the gardener")).toBeInTheDocument();
    expect(screen.getByText("Photos show a different site")).toBeInTheDocument();
  });

  it("leaves the feedback out when the review gave none", () => {
    renderSummary(reviewed({ status: "approved" }));

    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.queryByText("Feedback to the gardener")).not.toBeInTheDocument();
  });
});
