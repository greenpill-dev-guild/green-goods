/**
 * @vitest-environment jsdom
 */

import { claimFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { commitmentDialogControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import type { TxActPhase } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { describe, expect, it, vi } from "vitest";
import { CommitmentClaims } from "@/views/Garden/Pool/CommitmentDialog/CommitmentClaims";
import { renderWithProviders, screen, userEvent, within } from "../test-utils";

const PERSON = "0x1111111111111111111111111111111111111111" as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

// A garden claims as a party and is named from the gardens list; a person's
// name resolves through ENS, which is not read from the network here.
vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({
    data: [{ id: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", name: "Rocinha" }],
  }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null, isLoading: false }),
}));

function renderClaims(
  overrides: Partial<Parameters<typeof CommitmentClaims>[0]> = {},
  claims = [claimFixture({ claimant: PERSON, claimType: "INDIVIDUAL" })]
) {
  const acceptClaim = vi.fn().mockResolvedValue(undefined);
  const onOpenDialog = vi.fn();
  const controller = commitmentDialogControllerFixture();
  renderWithProviders(
    <CommitmentClaims
      claims={claims}
      chainId={42161}
      can={{ ...controller.can, acceptClaim: true }}
      acts={{ ...controller.acts, acceptClaim }}
      phaseFor={() => ({ status: "idle" })}
      actDisabled={false}
      onOpenDialog={onOpenDialog}
      {...overrides}
    />
  );
  return { acceptClaim, onOpenDialog };
}

describe("CommitmentClaims", () => {
  it("keeps steward actions 44px-targeted and operable by pointer and keyboard", async () => {
    const { acceptClaim, onOpenDialog } = renderClaims();

    const user = userEvent.setup();
    const accept = screen.getByRole("button", { name: "Accept" });
    const decline = screen.getByRole("button", { name: /Decline/ });
    expect(accept).toHaveClass("h-7");
    expect(decline).toHaveClass("h-7");

    await user.click(accept);
    decline.focus();
    await user.keyboard("{Enter}");

    expect(acceptClaim).toHaveBeenCalledTimes(1);
    expect(onOpenDialog).toHaveBeenCalledWith(expect.objectContaining({ kind: "decline-claim" }));
  });

  it("names a garden that claims as a party by its name, never its address", () => {
    renderClaims({}, [claimFixture({ claimant: GARDEN, claimType: "GARDEN" })]);
    const row = screen.getByTestId(`commitment-claim-${GARDEN}`);
    expect(within(row).getByText("Rocinha")).toBeInTheDocument();
    expect(within(row).queryByText(/0xaaaa/i)).not.toBeInTheDocument();
  });

  it("shows where Accept stands on its own row and holds that row closed until the index moves on", () => {
    const phases: Record<string, TxActPhase> = {
      [PERSON]: { status: "confirming", key: "accept", hash: `0x${"a".repeat(64)}` },
    };
    renderClaims({ phaseFor: (claimant) => phases[claimant] ?? { status: "idle" } }, [
      claimFixture({ claimant: PERSON, claimType: "INDIVIDUAL" }),
      claimFixture({ id: "claim-2", claimant: GARDEN, claimType: "GARDEN" }),
    ]);

    const accepting = screen.getByTestId(`commitment-claim-${PERSON}`);
    expect(within(accepting).getByRole("status")).toHaveTextContent(/^Confirming on .+…$/);
    expect(within(accepting).getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(within(accepting).getByRole("button", { name: /Decline/ })).toBeDisabled();

    const other = screen.getByTestId(`commitment-claim-${GARDEN}`);
    expect(within(other).queryByRole("status")).not.toBeInTheDocument();
    expect(within(other).getByRole("button", { name: "Accept" })).toBeEnabled();
  });

  it("says the request was accepted and keeps it closed until it leaves the list, and reopens after a failure", () => {
    const { rerender } = renderWithProviders(<div />);
    const controller = commitmentDialogControllerFixture();
    const view = (phase: TxActPhase) => (
      <CommitmentClaims
        claims={[claimFixture({ claimant: PERSON, claimType: "INDIVIDUAL" })]}
        chainId={42161}
        can={{ ...controller.can, acceptClaim: true }}
        acts={controller.acts}
        phaseFor={() => phase}
        actDisabled={false}
        onOpenDialog={vi.fn()}
      />
    );

    rerender(view({ status: "confirmed", key: "accept", hash: null }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Accepted. The request leaves this list once the index shows it."
    );
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();

    rerender(view({ status: "failed", key: "accept" }));
    expect(screen.getByRole("status")).toHaveTextContent(/nothing changed/i);
    expect(screen.getByRole("button", { name: "Accept" })).toBeEnabled();
  });
});
