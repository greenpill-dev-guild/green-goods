import type { Address } from "@green-goods/shared/types/domain";
import { claimFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClaimDecisionPanel } from "../../views/Home/Garden/Commitment/ClaimDecisionPanel";
import { renderWithProviders, screen } from "../test-utils";

const CLAIMANT = "0x1111111111111111111111111111111111111111" as Address;
const REQUESTER = "0x2222222222222222222222222222222222222222" as Address;

describe("ClaimDecisionPanel", () => {
  it("renders nothing without pending requests", () => {
    const { container } = renderWithProviders(
      <ClaimDecisionPanel requests={[]} isPending={false} onAccept={vi.fn()} onDecline={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("accepts a request and identifies a different requester", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    renderWithProviders(
      <ClaimDecisionPanel
        requests={[claimFixture({ claimant: CLAIMANT, requestedBy: REQUESTER })]}
        isPending={false}
        onAccept={onAccept}
        onDecline={vi.fn()}
      />
    );

    expect(screen.getByText(/asked by/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Accept" }));
    expect(onAccept).toHaveBeenCalledWith(CLAIMANT);
  });

  it("requires and trims a decline reason", async () => {
    const user = userEvent.setup();
    const onDecline = vi.fn();
    renderWithProviders(
      <ClaimDecisionPanel
        requests={[claimFixture({ claimant: CLAIMANT, requestedBy: CLAIMANT })]}
        isPending={false}
        onAccept={vi.fn()}
        onDecline={onDecline}
      />
    );

    await user.click(screen.getByRole("button", { name: "Decline" }));
    const submit = screen.getByRole("button", { name: "Decline" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: /why not/i }), "  Already covered  ");
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(onDecline).toHaveBeenCalledWith(CLAIMANT, "Already covered");
    expect(screen.queryByText(/asked by/i)).not.toBeInTheDocument();
  });

  it("disables every decision while one is pending", () => {
    renderWithProviders(
      <ClaimDecisionPanel
        requests={[claimFixture({ claimant: CLAIMANT })]}
        isPending
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Accept" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
  });
});
