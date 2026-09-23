/**
 * @vitest-environment jsdom
 */

import type { CommitmentSettlementController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import {
  commitmentSettlementControllerFixture,
  settlementChainStateFixture,
  settlementDisbursementFixture,
  settlementPlanFixture,
} from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import type { Address } from "@green-goods/shared/types/domain";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const MARIA = "0x1111111111111111111111111111111111111111" as Address;
const G = 10n ** 18n;

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: { success: mocks.toastSuccess, error: mocks.toastError },
}));

// A Radix dialog opened over the inspector flickers out in jsdom (the
// CommitmentDialog test precedent): the reason dialog becomes a plain region.
vi.mock("@/components/AdminReasonDialog", () => ({
  AdminReasonDialog: ({
    isOpen,
    title,
    confirmLabel,
    onConfirm,
  }: {
    isOpen: boolean;
    title: string;
    confirmLabel: string;
    onConfirm: (reason: string) => void | Promise<void>;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <button type="button" onClick={() => void onConfirm("wrong recipient")}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

const { CommitmentSettlement } = await import(
  "@/views/Garden/Pool/CommitmentDialog/CommitmentSettlement"
);

function preparedPlan() {
  return settlementPlanFixture({
    finalized: true,
    status: "PENDING",
    beneficiaryDisbursementId: 40n,
    preparedPayoutCount: 1,
  });
}

function stepStatus(id: string) {
  return screen
    .getByTestId("settlement-steps")
    .querySelector(`[data-step="${id}"]`)
    ?.getAttribute("data-status");
}

describe("CommitmentSettlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the protocol → garden Safe sequence with plan creation as the next act", () => {
    const settlement = commitmentSettlementControllerFixture();
    renderWithProviders(<CommitmentSettlement settlement={settlement} tone="garden" />);

    expect(screen.getByText("Garden beneficiary payout")).toBeInTheDocument();
    expect(screen.getByText("250 G$")).toBeInTheDocument();
    expect(screen.getByText("Beneficiary Safe registered and active")).toBeInTheDocument();
    expect(screen.getByText("Not created yet")).toBeInTheDocument();
    expect(stepStatus("create-plan")).toBe("current");
    expect(stepStatus("finalize-plan")).toBe("upcoming");
    expect(stepStatus("prepare-payout")).toBe("upcoming");
    expect(stepStatus("dispatch")).toBe("upcoming");
    expect(stepStatus("acknowledgement")).toBe("upcoming");
    expect(screen.getByRole("button", { name: "Create Payout Plan…" })).toBeEnabled();
    expect(screen.queryByTestId("settlement-blockers")).not.toBeInTheDocument();
  });

  it("requires an explicit review before every transaction and reports confirmation", async () => {
    const createPlan = vi.fn(async () => "0xabc123456789" as `0x${string}`);
    const settlement = commitmentSettlementControllerFixture({
      acts: { ...commitmentSettlementControllerFixture().acts, createPlan },
    });
    renderWithProviders(<CommitmentSettlement settlement={settlement} tone="garden" />);

    fireEvent.click(screen.getByRole("button", { name: "Create Payout Plan…" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Create payout plan for 250 G\$/)).toBeInTheDocument();
    expect(createPlan).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Send Transaction" }));
    await waitFor(() => expect(createPlan).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Settlement step confirmed" })
      )
    );
  });

  it("resumes from an existing plan and never offers creation again", () => {
    const settlement = commitmentSettlementControllerFixture({
      chain: settlementChainStateFixture({ payoutPlanId: 7n, plan: settlementPlanFixture() }),
    });
    renderWithProviders(<CommitmentSettlement settlement={settlement} tone="garden" />);

    expect(screen.getByText("Plan #7 · Draft")).toBeInTheDocument();
    expect(stepStatus("create-plan")).toBe("done");
    expect(stepStatus("finalize-plan")).toBe("current");
    expect(screen.queryByRole("button", { name: "Create Payout Plan…" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finalize Payout Plan…" })).toBeEnabled();
  });

  it("offers the garden payout preparation after finalization while gardener delivery stays off", () => {
    const settlement = commitmentSettlementControllerFixture({
      chain: settlementChainStateFixture({
        payoutPlanId: 7n,
        plan: settlementPlanFixture({ finalized: true, status: "PENDING" }),
        gardenerDeliveryEnabled: false,
      }),
    });
    renderWithProviders(<CommitmentSettlement settlement={settlement} tone="garden" />);
    expect(stepStatus("prepare-payout")).toBe("current");
    expect(screen.getByRole("button", { name: "Prepare Garden Payout…" })).toBeEnabled();
  });

  it("shows queued, dispatch, acknowledgement and confirmed states for the child disbursement", () => {
    const queued = commitmentSettlementControllerFixture({
      chain: settlementChainStateFixture({
        payoutPlanId: 7n,
        plan: preparedPlan(),
        disbursements: [settlementDisbursementFixture()],
      }),
    });
    const { unmount } = renderWithProviders(
      <CommitmentSettlement settlement={queued} tone="garden" />
    );
    expect(stepStatus("dispatch")).toBe("current");
    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Dispatch…" }).length).toBeGreaterThan(0);
    unmount();

    const awaiting = commitmentSettlementControllerFixture({
      chain: settlementChainStateFixture({
        payoutPlanId: 7n,
        plan: preparedPlan(),
        disbursements: [
          settlementDisbursementFixture({
            state: "DISPATCHED",
            attempt: 1,
            dispatchedAt: 1_756_000_000,
            acknowledgmentPending: true,
          }),
        ],
      }),
    });
    const second = renderWithProviders(
      <CommitmentSettlement settlement={awaiting} tone="garden" />
    );
    expect(stepStatus("dispatch")).toBe("done");
    expect(stepStatus("acknowledgement")).toBe("current");
    expect(screen.getByText("Awaiting acknowledgement")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Command…" })).toBeEnabled();
    second.unmount();

    const complete = commitmentSettlementControllerFixture({
      chain: settlementChainStateFixture({
        payoutPlanId: 7n,
        plan: settlementPlanFixture({
          ...preparedPlan(),
          status: "COMPLETE",
          confirmedPayoutCount: 1,
        }),
        disbursements: [settlementDisbursementFixture({ state: "CONFIRMED", attempt: 1 })],
      }),
    });
    renderWithProviders(<CommitmentSettlement settlement={complete} tone="garden" />);
    expect(screen.getByText("Payout complete")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /…$/ })).not.toBeInTheDocument();
  });

  it("blocks a garden → member payout while gardener delivery is disabled and names the gate", () => {
    const settlement = commitmentSettlementControllerFixture({
      chain: settlementChainStateFixture({
        kind: "CONTRIBUTOR_CONSIDERATION",
        payoutPlanId: 8n,
        plan: settlementPlanFixture({
          payoutPlanId: 8n,
          payoutKind: "CONTRIBUTOR_CONSIDERATION",
          finalized: true,
          status: "PENDING",
          beneficiaryGarden: null,
          beneficiaryRecipient: null,
          beneficiaryAmount: 0n,
          contributorPayoutTotal: 250n * G,
        }),
        rows: [
          {
            contributor: MARIA,
            recipient: MARIA,
            amount: 250n * G,
            recognitionWeightBps: 10_000,
            paymentWeightBps: 10_000,
            disbursementId: null,
          },
        ],
        gardenerDeliveryEnabled: false,
      }),
    });
    renderWithProviders(<CommitmentSettlement settlement={settlement} tone="garden" />);

    expect(screen.getByText("Contributor consideration")).toBeInTheDocument();
    expect(screen.getByText("Gardener delivery is off")).toBeInTheDocument();
    expect(stepStatus("prepare-payout")).toBe("current");
    expect(
      within(screen.getByTestId("settlement-blockers")).getByText(/Gardener delivery is off\./)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Prepare Payout for/ })).not.toBeInTheDocument();
  });

  it("offers member preparation once gardener delivery is enabled", () => {
    const settlement = commitmentSettlementControllerFixture({
      chain: settlementChainStateFixture({
        kind: "CONTRIBUTOR_CONSIDERATION",
        payoutPlanId: 8n,
        plan: settlementPlanFixture({
          payoutPlanId: 8n,
          payoutKind: "CONTRIBUTOR_CONSIDERATION",
          finalized: true,
          status: "PENDING",
          beneficiaryGarden: null,
          beneficiaryRecipient: null,
          beneficiaryAmount: 0n,
          contributorPayoutTotal: 250n * G,
        }),
        rows: [
          {
            contributor: MARIA,
            recipient: MARIA,
            amount: 250n * G,
            recognitionWeightBps: 10_000,
            paymentWeightBps: 10_000,
            disbursementId: null,
          },
        ],
        gardenerDeliveryEnabled: true,
      }),
    });
    renderWithProviders(<CommitmentSettlement settlement={settlement} tone="garden" />);
    expect(screen.getByText("Gardener delivery is on")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prepare Payout for 0x1111…1111…" })).toBeEnabled();
  });

  it("explains a missing role instead of offering the act, and distinguishes a disconnected wallet", () => {
    const missingRole = commitmentSettlementControllerFixture({
      authority: {
        isPayerSteward: false,
        canDispatchOrRetry: false,
        canRequeueOrCancel: false,
        resolved: true,
      },
    });
    const first = renderWithProviders(
      <CommitmentSettlement settlement={missingRole} tone="garden" />
    );
    expect(screen.queryByRole("button", { name: "Create Payout Plan…" })).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("settlement-blockers")).getByText(
        "Only a steward or owner of the paying garden can run the payout plan."
      )
    ).toBeInTheDocument();
    first.unmount();

    const disconnected = commitmentSettlementControllerFixture({ viewer: undefined });
    renderWithProviders(<CommitmentSettlement settlement={disconnected} tone="garden" />);
    expect(
      within(screen.getByTestId("settlement-blockers")).getByText("Connect a wallet to act.")
    ).toBeInTheDocument();
  });

  it("explains an ineligible record and a failed chain read as specific reasons", () => {
    const ineligible = commitmentSettlementControllerFixture({
      eligibility: { eligible: false, kind: null, blockers: ["no-celo-consideration"] },
    });
    const first = renderWithProviders(
      <CommitmentSettlement settlement={ineligible} tone="garden" />
    );
    expect(
      screen.getByText("No Celo G$ consideration is declared on this commitment.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("settlement-steps")).not.toBeInTheDocument();
    first.unmount();

    const refetch = vi.fn(async () => undefined);
    const failed = commitmentSettlementControllerFixture({
      chain: null,
      chainRead: "failed",
      refetch,
    });
    renderWithProviders(<CommitmentSettlement settlement={failed} tone="garden" />);
    expect(screen.getByText("Couldn't read the settlement module")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Read Again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Create Payout Plan…" })).not.toBeInTheDocument();
  });

  it("keeps the chain's state on screen after a rejected transaction", async () => {
    const createPlan = vi.fn(async () => {
      throw new Error("User rejected the request");
    });
    const settlement: CommitmentSettlementController = commitmentSettlementControllerFixture({
      acts: { ...commitmentSettlementControllerFixture().acts, createPlan },
      lastAct: { kind: "create-plan", phase: "failed", error: new Error("User rejected") },
    });
    renderWithProviders(<CommitmentSettlement settlement={settlement} tone="garden" />);

    expect(screen.getByTestId("settlement-act-status")).toHaveAttribute("data-phase", "failed");
    expect(
      screen.getByText("The transaction failed or was rejected. Nothing changed on chain.")
    ).toBeInTheDocument();
    expect(stepStatus("create-plan")).toBe("current");
    fireEvent.click(screen.getByRole("button", { name: "Create Payout Plan…" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Send Transaction" }));
    await waitFor(() => expect(createPlan).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(stepStatus("create-plan")).toBe("current");
  });

  it("offers requeue and a reasoned cancel for a failed child only to operators", async () => {
    const cancel = vi.fn(async () => "0xdef" as `0x${string}`);
    const chain = settlementChainStateFixture({
      payoutPlanId: 7n,
      plan: settlementPlanFixture({ ...preparedPlan(), status: "PARTIAL" }),
      disbursements: [
        settlementDisbursementFixture({ state: "FAILED", attempt: 1, failureCode: 7 }),
      ],
    });
    const operator = commitmentSettlementControllerFixture({
      chain,
      acts: { ...commitmentSettlementControllerFixture().acts, cancel },
    });
    const first = renderWithProviders(<CommitmentSettlement settlement={operator} tone="garden" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Requeue…" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel…" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel Disbursement" }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith(40n, "wrong recipient"));
    first.unmount();

    const stewardOnly = commitmentSettlementControllerFixture({
      chain,
      authority: {
        isPayerSteward: true,
        canDispatchOrRetry: false,
        canRequeueOrCancel: false,
        resolved: true,
      },
    });
    renderWithProviders(<CommitmentSettlement settlement={stewardOnly} tone="garden" />);
    expect(screen.queryByRole("button", { name: "Requeue…" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel…" })).not.toBeInTheDocument();
  });
});
