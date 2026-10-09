/**
 * @vitest-environment happy-dom
 */

import {
  claimFixture,
  commitmentFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { commitmentDialogControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import type { TxActPhase } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { claimRowKey } from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
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
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
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
      direction="OFFER"
      chainId={42161}
      can={{ ...controller.can, acceptClaim: true }}
      acts={{ ...controller.acts, acceptClaim }}
      phaseFor={() => ({ status: "idle" })}
      decisions={{}}
      standingOf={() => null}
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
    const accept = screen.getByRole("button", { name: "Approve" });
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

  it("puts an approval's progress in its own row's action slot, leaving the other rows' acts", () => {
    const phases: Record<string, TxActPhase> = {
      [PERSON]: { status: "confirming", key: "accept", hash: `0x${"a".repeat(64)}` },
    };
    renderClaims({ phaseFor: (claimant) => phases[claimant] ?? { status: "idle" } }, [
      claimFixture({ claimant: PERSON, claimType: "INDIVIDUAL" }),
      claimFixture({ id: "claim-2", claimant: GARDEN, claimType: "GARDEN" }),
    ]);

    const approving = screen.getByTestId(`commitment-claim-${PERSON}`);
    expect(within(approving).getByText(/^Confirming on .+…$/)).toBeInTheDocument();
    expect(within(approving).queryByRole("button")).not.toBeInTheDocument();

    const other = screen.getByTestId(`commitment-claim-${GARDEN}`);
    expect(within(other).queryByText(/^Confirming on/)).not.toBeInTheDocument();
    expect(within(other).getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("keeps an approved ask as its outcome, and brings the pair back as Try Again after a failure", () => {
    const { rerender } = renderWithProviders(<div />);
    const controller = commitmentDialogControllerFixture();
    const claim = claimFixture({ claimant: PERSON, claimType: "INDIVIDUAL" });
    const view = (phase: TxActPhase, approved: boolean) => (
      <CommitmentClaims
        claims={[claim]}
        direction="OFFER"
        chainId={42161}
        can={{ ...controller.can, acceptClaim: true }}
        acts={controller.acts}
        phaseFor={() => phase}
        decisions={
          approved
            ? {
                [claimRowKey({ claim, commitment: commitmentFixture() })]: {
                  kind: "approved",
                  commitmentId: claim.commitmentId.toString(),
                  at: Date.UTC(2026, 8, 28, 22, 42),
                },
              }
            : {}
        }
        standingOf={() => null}
        actDisabled={false}
        onOpenDialog={vi.fn()}
      />
    );

    rerender(view({ status: "confirmed", key: "accept", hash: null }, true));
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();

    rerender(view({ status: "failed", key: "accept" }, false));
    expect(screen.getByText(/nothing changed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeEnabled();
  });
});
