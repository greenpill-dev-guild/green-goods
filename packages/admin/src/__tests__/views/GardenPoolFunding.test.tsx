/** @vitest-environment jsdom */

import type { PoolFundingControllerView } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type {
  PoolFundingSnapshot,
  PoolFundingState,
} from "@green-goods/shared/modules/commitment-pooling/pool-funding";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PoolFundingDialog } from "@/views/Garden/Pool/PoolFundingDialog";
import { PoolFundingSection } from "@/views/Garden/Pool/PoolFundingSection";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const SAFE = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const TOKEN = "0x3333333333333333333333333333333333333333" as const;
const G = 10n ** 18n;

function snapshot(overrides: Partial<PoolFundingSnapshot> = {}): PoolFundingSnapshot {
  return {
    safe: SAFE,
    routeAddresses: { account: SAFE, indexed: SAFE, live: SAFE },
    token: TOKEN,
    balance: { value: 1_000n * G, blockNumber: 50n, blockTimestamp: 2_000, readAt: 2_001 },
    ledgerReadAt: 2_000,
    committed: 200n * G,
    expected: 100n * G,
    authorizedFeeBuffer: 2n * G,
    expectedFeeBuffer: 1n * G,
    feeBuffer: 3n * G,
    quotedFees: 2n * G,
    feeQuotes: [],
    available: 697n * G,
    shortfall: 0n,
    suggestedTopUp: 0n,
    fundingState: "healthy",
    fundingUnavailableReasons: [],
    settlementReadiness: "ready",
    settlementUnavailableReasons: [],
    obligations: [],
    transit: { dispatched: 20n * G, executedAwaitingConfirmation: 10n * G, incoming: 30n * G },
    disbursements: [],
    executions: [],
    limits: {
      rolesAllowanceRemaining: 500n * G,
      periodAllowanceRemaining: 800n * G,
      maxTransferAmount: 7_000n * G,
      maxBatchAmount: 10_000n * G,
      batchSizeLimit: 2,
    },
    nativeFeeBalance: 5n * G,
    ...overrides,
  };
}

function fundingView(
  overrides: Partial<PoolFundingControllerView> = {}
): PoolFundingControllerView {
  return {
    snapshot: snapshot(),
    isLoading: false,
    isFetching: false,
    isRefetching: false,
    isError: false,
    hasStaleBalance: false,
    lastReadAt: 2_001,
    ledgerReadAt: 2_000,
    refetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderSection(view = fundingView(), protocolContext = false) {
  const open = vi.fn();
  renderWithProviders(
    <PoolFundingSection funding={view} protocolContext={protocolContext} onOpenDetails={open} />
  );
  return { open };
}

function FundingDetailsHarness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const funding = fundingView();
  return (
    <>
      <PoolFundingSection
        funding={funding}
        onOpenDetails={() => setOpen(true)}
        detailsButtonRef={triggerRef}
      />
      <PoolFundingDialog
        open={open}
        onOpenChange={setOpen}
        funding={funding}
        tone="garden"
        returnFocusRef={triggerRef}
      />
    </>
  );
}

describe("PoolFundingSection", () => {
  it("shows the canonical Safe, balance, committed amount, available amount, and readiness", () => {
    renderSection();
    expect(screen.getByRole("heading", { name: "Pool funding" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /0x1111…1111/i })).toHaveAttribute(
      "href",
      expect.stringContaining(`/address/${SAFE}`)
    );
    expect(screen.getByText("1,000 G$")).toBeInTheDocument();
    expect(screen.getByText("200 G$")).toBeInTheDocument();
    expect(screen.getByText("697 G$")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Settlement ready")).toBeInTheDocument();
  });

  it("keeps initial loading stable and never renders a temporary zero", () => {
    renderSection(fundingView({ snapshot: null, isLoading: true, isFetching: true }));
    expect(screen.getByRole("status", { name: /loading pool funding/i })).toBeInTheDocument();
    expect(screen.queryByText("0 G$")).not.toBeInTheDocument();
  });

  it("shows no configured Safe and unavailable derivations without turning them into zero", () => {
    renderSection(
      fundingView({
        snapshot: snapshot({
          safe: null,
          routeAddresses: { account: null, indexed: null, live: null },
          balance: null,
          committed: null,
          available: null,
          fundingState: "unavailable",
          fundingUnavailableReasons: ["missing_account", "balance_unreadable"],
          settlementReadiness: "unavailable",
          settlementUnavailableReasons: ["missing_account", "balance_unreadable"],
        }),
      })
    );
    expect(screen.getByText("No settlement Safe configured")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("0 G$")).not.toBeInTheDocument();
  });

  it("reports an initial read failure as unavailable instead of a missing Safe", () => {
    renderSection(fundingView({ snapshot: null, isError: true }));
    expect(screen.getAllByText("Funding unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByText("No settlement Safe configured")).not.toBeInTheDocument();
  });

  it("retains a failed prior balance only as a last read and removes health classification", () => {
    renderSection(fundingView({ isError: true }));
    expect(screen.getByText(/last read/i)).toBeInTheDocument();
    expect(screen.getByText("Funding unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it.each<[PoolFundingState, string]>([
    ["insufficient", "Insufficient"],
    ["low", "Low balance"],
    ["healthy", "Healthy"],
    ["no-demand", "No current demand"],
  ])("renders the %s state using text and an icon", (state, label) => {
    const { container } = renderWithProviders(
      <PoolFundingSection
        funding={fundingView({ snapshot: snapshot({ fundingState: state }) })}
        onOpenDetails={() => undefined}
      />
    );
    const badge = screen.getByText(label).closest("span");
    expect(badge).toBeInTheDocument();
    expect(badge?.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("[data-component='PoolFundingSection']")).toBeInTheDocument();
  });

  it("uses the same component for Protocol context and adds only the treasury note", () => {
    renderSection(fundingView(), true);
    expect(screen.getByText(/upstream treasury inflow is not recorded/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pool funding" })).toBeInTheDocument();
  });

  it("shares one manual refresh and announces only its completion", async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    renderSection(fundingView({ refetch }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh Pool Funding" }));
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Pool funding refreshed")).toBeInTheDocument();
  });

  it("returns keyboard focus to the details trigger when the dialog closes", async () => {
    renderWithProviders(<FundingDetailsHarness />);
    const trigger = screen.getByRole("button", { name: "View Funding Details" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Pool funding details" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("PoolFundingDialog", () => {
  it("separates G$ liquidity from the native CELO network-fee reserve", () => {
    renderWithProviders(
      <PoolFundingDialog
        open
        onOpenChange={() => undefined}
        funding={fundingView()}
        tone="garden"
      />
    );
    const dialog = screen.getByRole("dialog", { name: "Pool funding details" });
    expect(within(dialog).getByText("Balance composition")).toBeInTheDocument();
    const network = within(dialog).getByRole("heading", { name: "Network fees" }).parentElement!;
    expect(within(network).getByText(/5 CELO/)).toBeInTheDocument();
    expect(within(network).getByText(/not G\$ pool liquidity/i)).toBeInTheDocument();
  });

  it("shows every conflicting route address and the unavailable reason", () => {
    renderWithProviders(
      <PoolFundingDialog
        open
        onOpenChange={() => undefined}
        funding={fundingView({
          snapshot: snapshot({
            safe: null,
            routeAddresses: { account: SAFE, indexed: OTHER, live: null },
            fundingState: "unavailable",
            fundingUnavailableReasons: ["route_mismatch"],
            settlementReadiness: "unavailable",
            settlementUnavailableReasons: ["route_mismatch"],
          }),
        })}
        tone="garden"
      />
    );
    expect(screen.getByText(new RegExp(SAFE, "i"))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(OTHER, "i"))).toBeInTheDocument();
    expect(screen.getByText(/do not agree/i)).toBeInTheDocument();
  });

  it("explains when the Celo acknowledgment reserve needs replenishment", () => {
    renderWithProviders(
      <PoolFundingDialog
        open
        onOpenChange={() => undefined}
        funding={fundingView({
          snapshot: snapshot({
            settlementReadiness: "unavailable",
            settlementUnavailableReasons: ["acknowledgment_reserve_low"],
          }),
        })}
        tone="garden"
      />
    );
    expect(screen.getByText(/acknowledgment reserve needs replenishment/i)).toBeInTheDocument();
  });

  it("does not identify a fee payer when the quote payer is unreadable", () => {
    renderWithProviders(
      <PoolFundingDialog
        open
        onOpenChange={() => undefined}
        funding={fundingView({
          snapshot: snapshot({
            feeQuotes: [
              {
                id: "quote-1",
                amount: 100n * G,
                fee: 1n * G,
                senderPays: null,
                recipient: OTHER,
              },
            ],
            settlementReadiness: "unavailable",
            settlementUnavailableReasons: ["fee_quote_unavailable"],
          }),
        })}
        tone="garden"
      />
    );
    expect(screen.getByText("Quote unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/recipient pays/i)).not.toBeInTheDocument();
  });

  it.each([
    ["missing", fundingView({ snapshot: null })],
    ["stale", fundingView({ isError: true })],
  ])("does not report %s funding data as settlement ready", (_state, funding) => {
    renderWithProviders(
      <PoolFundingDialog open onOpenChange={() => undefined} funding={funding} tone="garden" />
    );
    expect(screen.getByText("Settlement unavailable")).toBeInTheDocument();
    expect(
      screen.queryByText("Account, route, token, fees, and limits are ready.")
    ).not.toBeInTheDocument();
  });
});
