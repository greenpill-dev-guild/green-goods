import type {
  ServiceIssuerAction,
  ServiceIssuerOutcome,
} from "@green-goods/shared/commitment-pooling";
import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServiceIssuerPanel } from "../../views/Profile/ServiceIssuerPanel";
import {
  issuerStoryAssets,
  issuerStoryReview,
  issuerStorySnapshot,
  ISSUER_STORY_HASH,
} from "../../views/Profile/serviceIssuerStoryFixtures";
import { parseIssuerAmount } from "../../views/Profile/serviceIssuerPresentation";
import { renderWithProviders, screen, userEvent, within } from "../test-utils";

function harness() {
  return {
    snapshot: issuerStorySnapshot(),
    assets: issuerStoryAssets,
    onRefresh: vi.fn().mockResolvedValue(undefined),
    onReview: vi.fn(async (action: ServiceIssuerAction) => issuerStoryReview(action)),
    onExecute: vi.fn().mockResolvedValue({
      status: "confirmed",
      transactionHash: ISSUER_STORY_HASH,
      currentStateMatchesReceipt: true,
    }),
    onReconcile: vi.fn<() => Promise<ServiceIssuerOutcome | null>>().mockResolvedValue(null),
    onQuote: vi.fn(
      async ({ amount, outputAssetId }: { amount: bigint; outputAssetId: string }) => ({
        amount,
        outputAssetId,
        quotedOutput: 2_000_000n,
        grossOutput: 2_000_000n,
        reservedOutputFees: 0n,
        observedAt: 1_900_000_000n,
        expiresAt: 1_900_000_300n,
      })
    ),
  };
}

async function prepare(kind = "approveExchange", amount = "1") {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Action"), kind);
  if (["issue", "approveReserve", "approveExchange", "exchange"].includes(kind))
    await user.type(screen.getByLabelText("Quantity (EHELP)"), amount);
  await user.click(screen.getByRole("button", { name: "Review Action" }));
  return user;
}

describe("service issuer account surface", () => {
  it("keeps holder balances and issuer reserve separate without inventing services owed", () => {
    const h = harness();
    h.snapshot.holdingBalance = 500_000n;
    h.snapshot.actor.address = "0x6666666666666666666666666666666666666666";
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    expect(screen.getByText("Vouchers You Hold").nextElementSibling).toHaveTextContent("0.5 EHELP");
    expect(screen.getByText("3.5 EHELP")).toBeInTheDocument();
    expect(screen.getByText(/Total services owed: unknown/)).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Issue Vouchers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Services You Provide" })).not.toBeInTheDocument();
    expect(h.onExecute).not.toHaveBeenCalled();
  });

  it("reviews a finite quantity and signs exactly the reviewed object only after consent", async () => {
    const h = harness();
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    const user = await prepare("approveReserve", "0.75");
    const dialog = await screen.findByRole("dialog");
    expect(h.onReview).toHaveBeenCalledWith({ kind: "approveReserve", amount: 750_000n });
    const sign = within(dialog).getByRole("button", { name: "Sign Reviewed Action" });
    expect(sign).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(sign);
    expect(h.onExecute).toHaveBeenCalledOnce();
    expect(h.onExecute.mock.calls[0][0]).toBe(await h.onReview.mock.results[0].value);
    expect(await screen.findByRole("link", { name: /View on Gnosisscan/ })).toHaveAttribute(
      "href",
      `https://gnosisscan.io/tx/${ISSUER_STORY_HASH}`
    );
  });

  it("cancellation signs nothing and a changed canonical snapshot invalidates the displayed review", async () => {
    const h = harness();
    const view = renderWithProviders(<ServiceIssuerPanel {...h} />);
    const user = await prepare("revokeReserve");
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" })
    );
    expect(h.onExecute).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Review Action" }));
    await screen.findByRole("dialog");
    view.rerender(<ServiceIssuerPanel {...h} snapshot={{ ...h.snapshot, reserveAllowance: 0n }} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.rerender(<ServiceIssuerPanel {...h} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(h.onExecute).not.toHaveBeenCalled();
  });

  it("does not offer resend while a persisted transaction needs reconciliation", async () => {
    const h = harness();
    h.snapshot.pending = {
      version: 1,
      actor: h.snapshot.actor,
      review: issuerStoryReview({ kind: "issue", amount: 1n }),
    };
    h.onReconcile.mockResolvedValue({ status: "pending", pending: h.snapshot.pending });
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    expect(screen.queryByRole("button", { name: "Review Action" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve Booking" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Check Transaction Status" }));
    expect(h.onReconcile).toHaveBeenCalledOnce();
    expect(h.onExecute).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Review Action" })).not.toBeInTheDocument();
  });

  it("an ambiguous send keeps actions locked until an explicit status check, without a second send", async () => {
    const h = harness();
    h.onExecute.mockRejectedValue(new Error("provider disconnected"));
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    const user = await prepare("revokeReserve");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: "Sign Reviewed Action" }));
    expect(await screen.findByText(/That action could not be confirmed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review Action" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check Transaction Status" }));
    expect(await screen.findByRole("button", { name: "Review Action" })).toBeInTheDocument();
    expect(h.onExecute).toHaveBeenCalledOnce();
  });

  it("uses a real quote result with exact output protection and discards it after quantity changes", async () => {
    const h = harness();
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Action"), "exchange");
    await user.type(screen.getByLabelText("Quantity (EHELP)"), "1");
    await user.selectOptions(screen.getByLabelText("Receive"), "analyst-help");
    expect(screen.getByRole("button", { name: "Review Action" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Get Exchange Quote" }));
    expect(await screen.findByText(/Minimum Received: 2 AHELP/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review Action" }));
    expect(h.onReview).toHaveBeenCalledWith({
      kind: "exchange",
      amount: 1_000_000n,
      outputAssetId: "analyst-help",
      quotedOutput: 2_000_000n,
      minimumOutput: 2_000_000n,
      deadline: 1_900_000_300n,
    });
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" })
    );
    await user.type(screen.getByLabelText("Quantity (EHELP)"), "0");
    expect(screen.queryByText(/Minimum Received:/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review Action" })).toBeDisabled();
    expect(h.onExecute).not.toHaveBeenCalled();
  });

  it("uses only a verified issuer booking binding and bounds a separately reviewed return", async () => {
    const h = harness();
    const row = h.snapshot.bookings.records[0];
    const view = renderWithProviders(<ServiceIssuerPanel {...h} />);
    await userEvent.click(screen.getByRole("button", { name: "Approve Booking" }));
    expect(h.onReview).toHaveBeenCalledWith({
      kind: "approveBooking",
      setupId: row.setupId,
      authorizationHash: row.authorizationHash,
    });
    expect(h.onExecute).not.toHaveBeenCalled();
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" })
    );
    row.approvalEligible = false;
    row.returnEligible = true;
    row.result.issuerApproved = true;
    view.rerender(<ServiceIssuerPanel {...h} snapshot={{ ...h.snapshot }} />);
    const input = screen.getByLabelText("New Issuer Return Ceiling (EHELP)");
    fireEvent.change(input, { target: { value: "1.1" } });
    expect(screen.getByRole("button", { name: "Approve Issuer Return" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "0.5" } });
    await userEvent.click(screen.getByRole("button", { name: "Approve Issuer Return" }));
    expect(h.onReview).toHaveBeenLastCalledWith({
      kind: "authorizeReturn",
      setupId: row.setupId,
      authorizationHash: row.authorizationHash,
      ceiling: 500_000n,
    });
  });

  it("does not turn absent booking records into zero obligations", () => {
    const h = harness();
    h.snapshot.bookings = {
      status: "unavailable",
      completeness: "unknown",
      reason: "indexer-unavailable",
      records: [],
    };
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    expect(screen.getByText(/Booking discovery is unavailable/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve Booking" })).not.toBeInTheDocument();
    expect(screen.getByText(/Total services owed: unknown/)).toBeInTheDocument();
  });

  it("shows canonical delivered output rather than the earlier estimated quote after reconciliation", async () => {
    const h = harness();
    h.snapshot.pending = {
      version: 1,
      actor: h.snapshot.actor,
      review: issuerStoryReview({
        kind: "exchange",
        amount: 1_000_000n,
        outputAssetId: "analyst-help",
        quotedOutput: 2_000_000n,
        minimumOutput: 2_000_000n,
        deadline: 1_900_000_300n,
      }),
    };
    h.onReconcile.mockResolvedValue({
      status: "confirmed",
      transactionHash: ISSUER_STORY_HASH,
      deliveredOutput: 2_100_000n,
      currentStateMatchesReceipt: false,
    });
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    await userEvent.click(screen.getByRole("button", { name: "Check Transaction Status" }));
    expect(await screen.findByText("Actually Delivered: 2.1 AHELP")).toBeInTheDocument();
    expect(
      screen.getByText(/Current balances or approvals have changed since its receipt/)
    ).toBeInTheDocument();
    expect(h.onExecute).not.toHaveBeenCalled();
  });

  it("does not relabel historical service units using newer issuer terms", () => {
    const h = harness();
    h.snapshot.bookings.records[0].reviewedTermsMatch = false;
    h.snapshot.bookings.records[0].approvalEligible = false;
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    expect(screen.getByText("60 Unknown")).toBeInTheDocument();
    expect(screen.queryByText("60 minutes")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve Booking" })).not.toBeInTheDocument();
  });

  it("ignores a late review after the selected canonical actor changes", async () => {
    const h = harness();
    let resolve!: (value: ReturnType<typeof issuerStoryReview>) => void;
    h.onReview.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const view = renderWithProviders(<ServiceIssuerPanel {...h} />);
    await prepare("revokeReserve");
    view.rerender(
      <ServiceIssuerPanel
        {...h}
        snapshot={{
          ...h.snapshot,
          actor: { ...h.snapshot.actor, address: "0x6666666666666666666666666666666666666666" },
        }}
      />
    );
    view.rerender(<ServiceIssuerPanel {...h} />);
    resolve(issuerStoryReview({ kind: "revokeReserve" }));
    await waitFor(() => expect(screen.getByLabelText("Action")).toBeEnabled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(h.onExecute).not.toHaveBeenCalled();
  });

  it("guards duplicate confirmations while the first reviewed submission is unresolved", async () => {
    const h = harness();
    let resolve!: (value: ServiceIssuerOutcome) => void;
    h.onExecute.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    const user = await prepare("revokeExchange");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox"));
    const sign = within(dialog).getByRole("button", { name: "Sign Reviewed Action" });
    fireEvent.click(sign);
    fireEvent.click(sign);
    expect(h.onExecute).toHaveBeenCalledOnce();
    resolve({
      status: "pending",
      pending: {
        version: 1,
        actor: h.snapshot.actor,
        review: issuerStoryReview({ kind: "revokeExchange" }),
      },
    });
    await screen.findByRole("button", { name: "Check Transaction Status" });
    expect(h.onExecute).toHaveBeenCalledOnce();
  });

  it("shows a fixed partial split without offering a second issuer return approval", () => {
    const h = harness();
    const record = h.snapshot.bookings.records[0];
    record.approvalEligible = false;
    record.finalAllocation = {
      decisionId: ISSUER_STORY_HASH,
      activationDecisionId: ISSUER_STORY_HASH,
      issuerReturnApprovalAtFreeze: 500_000n,
      allocation: {
        approvedDeliveredServiceUnits: 30n,
        releaseVoucherUnits: 500_000n,
        refundVoucherUnits: 500_000n,
      },
      release: { state: "failed", attempts: 1n, failureHash: ISSUER_STORY_HASH },
      refund: { state: "succeeded", attempts: 1n, failureHash: null },
      financiallyClosed: false,
    };
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    expect(screen.getByText(/Recorded Delivery: 30 \/ 60 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/Return to Issuer Reserve: 0.5 EHELP \(Failed\)/)).toBeInTheDocument();
    expect(screen.getByText(/Refund to Holder: 0.5 EHELP \(Succeeded\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve Issuer Return" })).not.toBeInTheDocument();
    expect(h.onExecute).not.toHaveBeenCalled();
  });

  it("contains a failed balance refresh instead of leaking an unhandled rejection", async () => {
    const h = harness();
    h.onRefresh.mockRejectedValue(new Error("RPC unavailable"));
    renderWithProviders(<ServiceIssuerPanel {...h} snapshot={undefined} isError />);
    await userEvent.click(screen.getByRole("button", { name: "Refresh Balances" }));
    await waitFor(() => expect(h.onRefresh).toHaveBeenCalledOnce());
    expect(screen.getByText(/Service balances could not be read/)).toBeInTheDocument();
  });
});

describe("exact issuer quantity entry", () => {
  it.each([
    "1.0000001",
    "1e6",
    "-1",
    "1,5",
    "0",
    "Infinity",
  ])("rejects ambiguous or rounded input %s", (value) => {
    expect(parseIssuerAmount(value, 6)).toBeNull();
  });
  it("preserves base-unit precision without floating point", () => {
    expect(parseIssuerAmount("9007199254.740993", 6)).toBe(9_007_199_254_740_993n);
  });
});
