/**
 * @vitest-environment happy-dom
 */

import { useCreateAssessmentStore } from "@green-goods/shared/stores/useCreateAssessmentStore";
import type { Domain } from "@green-goods/shared/types/domain";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionsHarvestStep } from "@/components/Assessment/CreateAssessmentSteps/ActionsHarvestStep";

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useActions: () => ({ data: [] }),
}));

vi.mock("@green-goods/shared/hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 11155111,
}));

describe("ActionsHarvestStep", () => {
  beforeEach(() => {
    useCreateAssessmentStore.getState().reset();
  });

  it("renders for a restored draft whose domain no longer exists", () => {
    // A draft saved before a domain was retired can reopen on this step.
    useCreateAssessmentStore.getState().setField("domain", 99 as Domain);

    render(
      <IntlProvider locale="en" messages={{}} onError={() => {}}>
        <ActionsHarvestStep showValidation={false} isSubmitting={false} />
      </IntlProvider>
    );

    expect(
      screen.getByText("Select the actions that will be tracked under this assessment.")
    ).toBeVisible();
    // With no known domain there is nothing to list yet, so the step says why.
    expect(screen.getByText("Choose a domain on the first step to see its actions.")).toBeVisible();
    expect(screen.queryByText(/No actions registered for/)).not.toBeInTheDocument();
  });

  // A period names whole days, so one day is a period: only an end before the
  // start is out of order. The form schema and the send hold the same rule.
  it.each([
    { period: "one day", start: "2026-07-27", end: "2026-07-27", refused: false },
    { period: "an end before its start", start: "2026-07-28", end: "2026-07-27", refused: true },
  ])("a reporting period of $period: refused $refused", ({ start, end, refused }) => {
    const { setField } = useCreateAssessmentStore.getState();
    setField("reportingPeriodStart", start);
    setField("reportingPeriodEnd", end);

    render(
      <IntlProvider locale="en" messages={{}} onError={() => {}}>
        <ActionsHarvestStep showValidation isSubmitting={false} />
      </IntlProvider>
    );

    const error = screen.queryByText("End date can't be before start date");
    if (refused) expect(error).toBeVisible();
    else expect(error).not.toBeInTheDocument();
  });
});
