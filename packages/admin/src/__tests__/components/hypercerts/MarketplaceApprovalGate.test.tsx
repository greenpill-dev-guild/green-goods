/**
 * MarketplaceApprovalGate Component Tests
 *
 * Covers the full state matrix:
 * - unavailable: readiness reports missing/zero marketplace addresses
 * - checking: approvals query is loading and readiness is available
 * - needs-approval: readiness available, one or both approvals missing
 * - ready: readiness available, both approvals granted (renders children)
 * - pending: grantApprovals in flight
 * - failure: approval mutation surfaced a recoverable error
 */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render } from "../../test-utils";

const mockUseMarketplaceApprovals = vi.fn();
const mockGetMarketplaceReadiness = vi.fn();
const mockGrantApprovals = vi.fn();

const VALID_ADDRESS = "0x1111111111111111111111111111111111111111";

const READY_ADDRESSES = {
  marketplaceAdapter: "0xE396137ef12c30075fd0B8509C6e389750f36159",
  hypercertsModule: "0x9CB6300cb0DD64dfe577944d7a8AF70799Fe3ef0",
  hypercertExchange: "0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83",
  hypercertMinter: "0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07",
  transferManager: "0x658c1695DCb298E57e6144F6dA3e83DdCF5e2BaB",
  strategyHypercertFractionOffer: "0xecab24cade0261fc6513ca13bb3d10f760af3da8",
} as const;

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    DEFAULT_CHAIN_ID: 42161,
    Alert: ({
      variant,
      title,
      children,
    }: {
      variant: string;
      title?: string;
      children: ReactNode;
    }) =>
      createElement(
        "div",
        { role: variant === "error" ? "alert" : "status", "data-variant": variant },
        title ? createElement("p", null, title) : null,
        children
      ),
    useMarketplaceApprovals: (...args: unknown[]) => mockUseMarketplaceApprovals(...args),
    getMarketplaceReadiness: (...args: unknown[]) => mockGetMarketplaceReadiness(...args),
  };
});

import { MarketplaceApprovalGate } from "../../../components/Hypercerts/MarketplaceApprovalGate";

const CHILDREN_TEXT = "ready-state-children";

function renderGate(props: { chainId?: number } = {}) {
  return render(
    createElement(
      MarketplaceApprovalGate,
      { chainId: props.chainId ?? 42161 },
      createElement("div", { "data-testid": "gate-children" }, CHILDREN_TEXT)
    )
  );
}

const DEFAULT_APPROVALS_STATE = {
  approvals: { exchangeApproved: true, minterApproved: true },
  isFullyApproved: true,
  isLoading: false,
  error: null,
  grantApprovals: mockGrantApprovals,
  isGranting: false,
};

const READY_READINESS = {
  status: "available" as const,
  available: true as const,
  chainId: 42161,
  addresses: READY_ADDRESSES,
  missingFields: [] as never[],
  reason: "all_required_addresses_configured" as const,
};

const UNAVAILABLE_READINESS = {
  status: "unavailable" as const,
  available: false as const,
  chainId: 11155111,
  addresses: {
    marketplaceAdapter: VALID_ADDRESS,
    hypercertsModule: VALID_ADDRESS,
  },
  missingFields: [
    "hypercertExchange",
    "hypercertMinter",
    "transferManager",
    "strategyHypercertFractionOffer",
  ] as const,
  reason:
    "missing_required_marketplace_addresses:hypercertExchange,hypercertMinter,transferManager,strategyHypercertFractionOffer",
};

describe("components/Hypercerts/MarketplaceApprovalGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMarketplaceApprovals.mockReturnValue(DEFAULT_APPROVALS_STATE);
    mockGetMarketplaceReadiness.mockReturnValue(READY_READINESS);
  });

  describe("state: unavailable", () => {
    it("renders an unavailable alert and does NOT render children or approval CTA when readiness is unavailable", () => {
      mockGetMarketplaceReadiness.mockReturnValue(UNAVAILABLE_READINESS);

      renderGate({ chainId: 11155111 });

      expect(mockGetMarketplaceReadiness).toHaveBeenCalledWith(11155111);
      expect(screen.getByRole("status")).toHaveAttribute("data-variant", "warning");
      expect(screen.getByText(/Marketplace not available on this network/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Missing addresses:.*hypercertExchange.*hypercertMinter.*transferManager.*strategyHypercertFractionOffer/i
        )
      ).toBeInTheDocument();
      expect(screen.queryByTestId("gate-children")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /approve all/i })).not.toBeInTheDocument();
    });

    it("never calls useMarketplaceApprovals when readiness is unavailable (no unsafe approval reads)", () => {
      mockGetMarketplaceReadiness.mockReturnValue(UNAVAILABLE_READINESS);

      renderGate({ chainId: 11155111 });

      // The gate must short-circuit on unavailable readiness so that approval/listing
      // hooks are never invoked against zero-address marketplace contracts.
      expect(mockUseMarketplaceApprovals).not.toHaveBeenCalled();
    });
  });

  describe("state: checking", () => {
    it("renders a loading state when readiness is available but approvals query is loading", () => {
      mockUseMarketplaceApprovals.mockReturnValue({
        ...DEFAULT_APPROVALS_STATE,
        approvals: null,
        isFullyApproved: false,
        isLoading: true,
      });

      renderGate();

      expect(screen.getByText(/checking marketplace approvals/i)).toBeInTheDocument();
      expect(screen.queryByTestId("gate-children")).not.toBeInTheDocument();
    });
  });

  describe("state: needs-approval", () => {
    it("renders the approval CTA and does NOT render children when one or both approvals are missing", () => {
      mockUseMarketplaceApprovals.mockReturnValue({
        ...DEFAULT_APPROVALS_STATE,
        approvals: { exchangeApproved: false, minterApproved: false },
        isFullyApproved: false,
      });

      renderGate();

      expect(screen.getByRole("button", { name: /approve all/i })).toBeInTheDocument();
      expect(screen.queryByTestId("gate-children")).not.toBeInTheDocument();
    });

    it("invokes grantApprovals when the operator confirms the approval CTA", async () => {
      mockUseMarketplaceApprovals.mockReturnValue({
        ...DEFAULT_APPROVALS_STATE,
        approvals: { exchangeApproved: true, minterApproved: false },
        isFullyApproved: false,
      });

      renderGate();

      await userEvent.setup().click(screen.getByRole("button", { name: /approve all/i }));

      expect(mockGrantApprovals).toHaveBeenCalledTimes(1);
    });
  });

  describe("state: ready", () => {
    it("renders children when readiness is available and both approvals are granted", () => {
      renderGate();

      expect(screen.getByTestId("gate-children")).toHaveTextContent(CHILDREN_TEXT);
      expect(screen.queryByRole("button", { name: /approve all/i })).not.toBeInTheDocument();
    });
  });

  describe("state: pending", () => {
    it("renders the approving state with disabled CTA while grantApprovals is in flight", () => {
      mockUseMarketplaceApprovals.mockReturnValue({
        ...DEFAULT_APPROVALS_STATE,
        approvals: { exchangeApproved: false, minterApproved: false },
        isFullyApproved: false,
        isGranting: true,
      });

      renderGate();

      const approvingButton = screen.getByRole("button", { name: /approving/i });
      expect(approvingButton).toBeDisabled();
    });
  });

  describe("state: failure", () => {
    it("renders the approval mutation error and keeps the CTA available so the operator can retry", () => {
      mockUseMarketplaceApprovals.mockReturnValue({
        ...DEFAULT_APPROVALS_STATE,
        approvals: { exchangeApproved: false, minterApproved: false },
        isFullyApproved: false,
        error: new Error("Wallet rejected the request"),
      });

      renderGate();

      expect(screen.getByText(/wallet rejected the request/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /approve all/i })).toBeInTheDocument();
    });
  });
});
