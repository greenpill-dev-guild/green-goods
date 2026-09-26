/**
 * @vitest-environment jsdom
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
});
