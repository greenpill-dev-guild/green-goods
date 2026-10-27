import type {
  ServiceIssuerAction,
  ServiceIssuerOutcome,
  ServiceIssuerSnapshot,
} from "@green-goods/shared/commitment-pooling";
import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServiceIssuerPanel } from "../../views/Profile/ServiceIssuerPanel";
import {
  issuerServiceStory,
  issuerStoryAssets,
  issuerStoryReview,
  issuerStorySnapshot,
  ISSUER_STORY_HASH,
} from "../../views/Profile/serviceIssuerStoryFixtures";
import { parseIssuerAmount } from "../../views/Profile/serviceIssuerPresentation";
import { renderWithProviders, screen, userEvent, within } from "../test-utils";

// A booking row names its holder; these tests read no profile, ENS or Green Goods name.
vi.mock("@green-goods/shared/hooks/profile/useProfileAvatar", () => ({
  useResolvedProfileAvatar: () => ({ avatarUri: null, isLoading: false }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
}));

type Onchain = Extract<ServiceIssuerSnapshot, { evidence: "onchain" }>;
const HOLDER = "0x6666666666666666666666666666666666666666";

function harness(snapshot: Onchain = issuerServiceStory("overview")) {
  return {
    snapshot,
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

const fact = (label: string) =>
  screen
    .getAllByText(label)
    .map((element) => element.closest("[data-component=FactRow]"))
    .find(Boolean);
const bookingRows = () => document.querySelectorAll('[data-component="ServiceIssuerBookings"] li');
/** The exact review sheet, as opposed to a quantity sheet that may share its title. */
async function reviewSheet() {
  const sheet = await waitFor(() => {
    const found = document.querySelector('[data-component="ServiceIssuerReview"]');
    if (!found) throw new Error("No review yet");
    return found.closest('[role="dialog"]') as HTMLElement;
  });
  return within(sheet);
}

describe("a member's own service", () => {
  it("approves a booking only through its exact review, with the booking's own consent", async () => {
    const h = harness(issuerServiceStory("approve"));
    const asked = h.snapshot.bookings.records[0]!;
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    expect(screen.getByText(/agreed to your exact terms/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(h.onReview).toHaveBeenCalledWith({
      kind: "approveBooking",
      setupId: asked.setupId,
      authorizationHash: asked.authorizationHash,
    });
    const sheet = await reviewSheet();
    expect(sheet.getByText("Approve This Booking")).toBeInTheDocument();
    expect(sheet.getByText(/Approving isn't accepting/)).toBeInTheDocument();
    const approve = sheet.getByRole("button", { name: "Approve Booking" });
    expect(approve).toBeDisabled();
    await userEvent.click(sheet.getByRole("checkbox", { name: "I checked this exact booking" }));
    await userEvent.click(approve);
    expect(h.onExecute).toHaveBeenCalledOnce();
    expect(h.onExecute.mock.calls[0][0]).toBe(await h.onReview.mock.results[0]!.value);
    expect(await screen.findByRole("link", { name: /View on Gnosisscan/ })).toHaveAttribute(
      "href",
      `https://gnosisscan.io/tx/${ISSUER_STORY_HASH}`
    );
  });

  it("counts what the member can still deliver from terms and verified bookings, not balances", () => {
    renderWithProviders(<ServiceIssuerPanel {...harness()} />);
    expect(fact("Promised")).toHaveTextContent("6");
    expect(fact("Booked")).toHaveTextContent("2");
    expect(fact("Left")).toHaveTextContent("3");
    expect(fact("In the pool")).toHaveTextContent("1");
    expect(fact("In your reserve")).toHaveTextContent("4");
    expect(fact("In escrow for bookings")).toHaveTextContent("2");
    expect(fact("Approved for rewards")).toHaveTextContent("1 left of 1");
    expect(screen.getByRole("progressbar")).toHaveAccessibleName(
      "1 delivered, 2 booked, 3 left of 6"
    );
    expect(bookingRows()).toHaveLength(3);
  });

  it("does not turn an unread booking list into zero obligations", () => {
    const h = harness();
    h.snapshot.bookings = {
      status: "unavailable",
      completeness: "unknown",
      reason: "indexer-unavailable",
      records: [],
    };
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    expect(fact("Booked")).toHaveTextContent("Unknown");
    expect(fact("Left")).toHaveTextContent("Unknown");
    expect(
      screen.getByText(/Bookings couldn't be read. What you owe stays unknown/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review" })).not.toBeInTheDocument();
  });

  it("counts capacity from what the member confirmed, not the token's issuance ceiling", async () => {
    renderWithProviders(<ServiceIssuerPanel {...harness(issuerServiceStory("lowCapacity"))} />);
    expect(fact("Promised")).toHaveTextContent("5");
    expect(fact("Left")).toHaveTextContent("2");
    expect(screen.getByRole("progressbar")).toHaveAccessibleName(
      "1 delivered, 2 booked, 2 left of 5"
    );
    await userEvent.click(screen.getByRole("button", { name: "Issue More" }));
    expect(screen.getByText("Promised 5 · 5 issued · 0 more can be issued")).toBeInTheDocument();
  });

  it("keeps what's booked and left unknown when a booking couldn't be verified", () => {
    renderWithProviders(<ServiceIssuerPanel {...harness(issuerServiceStory("partial"))} />);
    for (const label of ["Booked", "Delivered", "Left", "In escrow for bookings"])
      expect(fact(label)).toHaveTextContent("Unknown");
    expect(screen.getByText(/Some bookings couldn't be verified/)).toBeInTheDocument();
    expect(bookingRows()).toHaveLength(3);
  });

  it("asks for no booking approval while new bookings are paused", () => {
    const h = harness(issuerServiceStory("paused"));
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    expect(screen.getByText("New bookings are paused")).toBeInTheDocument();
    expect(within(bookingRows()[0] as HTMLElement).getByText("Paused")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume Bookings" })).toBeInTheDocument();
  });

  it("reads a registered token whose cap hasn't landed as setup, not delisted", () => {
    renderWithProviders(<ServiceIssuerPanel {...harness(issuerServiceStory("registered"))} />);
    expect(screen.getByText("Next: Green Goods admits your token")).toBeInTheDocument();
    expect(screen.queryByText("Delisted from the pool")).not.toBeInTheDocument();
  });

  it("reads a delisted service as delisted while every booking and balance stays", () => {
    renderWithProviders(<ServiceIssuerPanel {...harness(issuerServiceStory("delisted"))} />);
    expect(screen.getByText("Delisted from the pool")).toBeInTheDocument();
    expect(screen.getByText(/Nothing was erased/)).toBeInTheDocument();
    expect(bookingRows()).toHaveLength(3);
    expect(fact("In the pool")).toHaveTextContent("1");
    expect(screen.queryByRole("button", { name: "Issue More" })).not.toBeInTheDocument();
  });

  it("approves a finite reward allowance through the exact review and signs only after consent", async () => {
    const h = harness(issuerServiceStory("short"));
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    expect(screen.getByText("Rewards can't draw on your reserve")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve for Rewards" }));
    await userEvent.type(screen.getByLabelText("How many (EHELP)"), "0.75");
    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(h.onReview).toHaveBeenCalledWith({ kind: "approveReserve", amount: 750_000n });
    const sheet = await reviewSheet();
    const sign = sheet.getByRole("button", { name: "Approve for Rewards" });
    expect(sign).toBeDisabled();
    await userEvent.click(sheet.getByRole("checkbox"));
    await userEvent.click(sign);
    expect(h.onExecute.mock.calls[0][0]).toBe(await h.onReview.mock.results[0]!.value);
  });

  it("issues more only within what was promised, and says why when the promise is full", async () => {
    const h = harness();
    const view = renderWithProviders(<ServiceIssuerPanel {...h} />);
    await userEvent.click(screen.getByRole("button", { name: "Issue More" }));
    expect(screen.getByText("Promised 6 · 5 issued · 1 more can be issued")).toBeInTheDocument();
    const field = screen.getByLabelText("How many (EHELP)");
    await userEvent.type(field, "2");
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
    await userEvent.clear(field);
    await userEvent.type(field, "1");
    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(h.onReview).toHaveBeenCalledWith({ kind: "issue", amount: 1_000_000n });
    expect((await reviewSheet()).getByRole("button", { name: "Issue 1 EHELP" })).toBeDisabled();
    view.unmount();
    renderWithProviders(<ServiceIssuerPanel {...harness(issuerServiceStory("full"))} />);
    await userEvent.click(screen.getByRole("button", { name: "Issue More" }));
    expect(
      screen.getByText("Issuing more would promise more than you can deliver.")
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("How many (EHELP)")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
  });

  it("pauses through its own exact review and says what pausing keeps", async () => {
    const h = harness();
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    await userEvent.click(screen.getByRole("button", { name: "Pause New Bookings" }));
    expect(h.onReview).toHaveBeenCalledWith({ kind: "configureReserve", enabled: false });
    const sheet = await reviewSheet();
    expect(sheet.getByText(/Booked services go ahead/)).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Pause" })).toBeDisabled();
  });

  it("cancellation signs nothing and a changed canonical snapshot invalidates the displayed review", async () => {
    const h = harness();
    const view = renderWithProviders(<ServiceIssuerPanel {...h} />);
    await userEvent.click(screen.getByRole("button", { name: "Pause New Bookings" }));
    await userEvent.click((await reviewSheet()).getByRole("button", { name: "Cancel" }));
    expect(h.onExecute).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Pause New Bookings" }));
    await reviewSheet();
    view.rerender(<ServiceIssuerPanel {...h} snapshot={{ ...h.snapshot, reserveAllowance: 0n }} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.rerender(<ServiceIssuerPanel {...h} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(h.onExecute).not.toHaveBeenCalled();
  });

  it("does not offer resend while a persisted transaction needs reconciliation", async () => {
    const h = harness(issuerServiceStory("pending"));
    h.onReconcile.mockResolvedValue({ status: "pending", pending: h.snapshot.pending! });
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    expect(screen.getByText("An earlier action still needs checking")).toBeInTheDocument();
    expect(screen.getByText("Approval sent · not confirmed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Issue More" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Check Status" }));
    expect(h.onReconcile).toHaveBeenCalledOnce();
    expect(h.onExecute).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Issue More" })).not.toBeInTheDocument();
  });

  it("an ambiguous send keeps acts locked until an explicit status check, without a second send", async () => {
    const h = harness();
    h.onExecute.mockRejectedValue(new Error("provider disconnected"));
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    await userEvent.click(screen.getByRole("button", { name: "Pause New Bookings" }));
    const sheet = await reviewSheet();
    await userEvent.click(sheet.getByRole("checkbox"));
    await userEvent.click(sheet.getByRole("button", { name: "Pause" }));
    expect(await screen.findByText(/That action could not be confirmed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Issue More" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Check Status" }));
    expect(await screen.findByRole("button", { name: "Issue More" })).toBeInTheDocument();
    expect(h.onExecute).toHaveBeenCalledOnce();
  });

  it("uses only a verified booking binding and bounds a separately reviewed return", async () => {
    const h = harness();
    const active = h.snapshot.bookings.records[1]!;
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    await userEvent.click(screen.getByRole("button", { name: "Propose Return" }));
    const field = screen.getByLabelText("Most that can come back (EHELP)");
    fireEvent.change(field, { target: { value: "1.1" } });
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
    fireEvent.change(field, { target: { value: "0.5" } });
    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(h.onReview).toHaveBeenLastCalledWith({
      kind: "authorizeReturn",
      setupId: active.setupId,
      authorizationHash: active.authorizationHash,
      ceiling: 500_000n,
    });
    expect((await reviewSheet()).getByText("Propose a Return")).toBeInTheDocument();
  });

  it("does not relabel a booking on earlier terms or offer to approve it", () => {
    const h = harness(issuerStorySnapshot());
    h.snapshot.bookings.records[0]!.reviewedTermsMatch = false;
    h.snapshot.bookings.records[0]!.approvalEligible = false;
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    expect(screen.getByText("Earlier terms")).toBeInTheDocument();
    expect(screen.queryByText("60 minutes")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review" })).not.toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("button", { name: "Pause New Bookings" }));
    view.rerender(
      <ServiceIssuerPanel
        {...h}
        snapshot={{ ...h.snapshot, actor: { ...h.snapshot.actor, address: HOLDER } }}
      />
    );
    view.rerender(<ServiceIssuerPanel {...h} />);
    resolve(issuerStoryReview({ kind: "configureReserve", enabled: false }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Pause New Bookings" })).toBeEnabled()
    );
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
    await userEvent.click(screen.getByRole("button", { name: "Pause New Bookings" }));
    const sheet = await reviewSheet();
    await userEvent.click(sheet.getByRole("checkbox"));
    const sign = sheet.getByRole("button", { name: "Pause" });
    fireEvent.click(sign);
    fireEvent.click(sign);
    expect(h.onExecute).toHaveBeenCalledOnce();
    resolve({
      status: "pending",
      pending: {
        version: 1,
        actor: h.snapshot.actor,
        review: issuerStoryReview({ kind: "configureReserve", enabled: false }),
      },
    });
    await screen.findByRole("button", { name: "Check Status" });
    expect(h.onExecute).toHaveBeenCalledOnce();
  });

  it("shows a fixed partial split as settling, without a second return to propose", () => {
    const h = harness(issuerStorySnapshot());
    const record = h.snapshot.bookings.records[0]!;
    record.approvalEligible = false;
    record.returnEligible = true;
    record.result.issuerApproved = true;
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
    expect(screen.getByText("Settling")).toBeInTheDocument();
    expect(screen.getByText("0.5 EHELP to your reserve")).toBeInTheDocument();
    expect(screen.getByText("0.5 EHELP back to the holder")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Propose Return" })).not.toBeInTheDocument();
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

describe("a holder of another member's vouchers", () => {
  function holder() {
    const h = harness(issuerStorySnapshot());
    h.snapshot.actor = { ...h.snapshot.actor, address: HOLDER };
    h.snapshot.holdingBalance = 500_000n;
    return h;
  }

  it("keeps the holder's vouchers apart from the issuer's acts and invents no services owed", () => {
    const h = holder();
    renderWithProviders(<ServiceIssuerPanel {...h} />);
    expect(fact("Vouchers You Hold")).toHaveTextContent("0.5 EHELP");
    expect(screen.getByText(/Total services owed: unknown/)).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Issue Vouchers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Issue More" })).not.toBeInTheDocument();
    expect(screen.queryByText("Bookings")).not.toBeInTheDocument();
    expect(h.onExecute).not.toHaveBeenCalled();
  });

  it("uses a real quote result with exact output protection and discards it after quantity changes", async () => {
    const h = holder();
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
    await user.click((await reviewSheet()).getByRole("button", { name: "Cancel" }));
    await user.type(screen.getByLabelText("Quantity (EHELP)"), "0");
    expect(screen.queryByText(/Minimum Received:/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review Action" })).toBeDisabled();
    expect(h.onExecute).not.toHaveBeenCalled();
  });

  it("shows canonical delivered output rather than the earlier estimated quote after reconciliation", async () => {
    const h = holder();
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
