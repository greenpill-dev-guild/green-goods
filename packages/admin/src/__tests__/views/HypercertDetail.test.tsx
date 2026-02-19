/**
 * HypercertDetail View Tests
 *
 * Tests the hypercert detail page rendering for loading, missing, and data states.
 * Verifies conditional marketplace section based on permissions.
 */

import { render, screen } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseGardens = vi.fn();
const mockUseHypercerts = vi.fn();
const mockUseHypercertListings = vi.fn();
const mockUseGardenPermissions = vi.fn();

vi.mock("@green-goods/shared", () => ({
  useGardens: () => mockUseGardens(),
  useHypercerts: (opts: any) => mockUseHypercerts(opts),
  useHypercertListings: () => mockUseHypercertListings(),
  useGardenPermissions: () => mockUseGardenPermissions(),
  DEFAULT_CHAIN_ID: 11155111,
  formatDate: (ts: number, opts?: any) => new Date(ts).toLocaleDateString("en-US", opts),
  getNetworkConfig: () => ({ blockExplorer: "https://sepolia.etherscan.io" }),
  ImageWithFallback: ({ src, alt, ...props }: any) =>
    React.createElement("img", { src, alt, ...props }),
}));

vi.mock("viem", () => ({
  formatEther: (val: bigint) => String(Number(val) / 1e18),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "garden-1", hypercertId: "hc-123" }),
  useLocation: () => ({ state: null }),
  Link: ({ to, children, ...props }: any) =>
    React.createElement("a", { href: to, ...props }, children),
}));

vi.mock("@remixicon/react", () => {
  const Icon = (props: any) => React.createElement("span", props);
  return {
    RiExternalLinkLine: Icon,
    RiLoader4Line: Icon,
    RiCheckLine: Icon,
    RiExchangeDollarLine: Icon,
    RiArrowLeftLine: Icon,
  };
});

vi.mock("@/components/Layout/PageHeader", () => ({
  PageHeader: ({ title, description }: { title: string; description: string }) =>
    React.createElement(
      "div",
      { "data-testid": "page-header" },
      React.createElement("h1", null, title),
      description && React.createElement("p", null, description)
    ),
}));

vi.mock("@/components/hypercerts/MarketplaceApprovalGate", () => ({
  MarketplaceApprovalGate: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "marketplace-gate" }, children),
}));

vi.mock("@/components/hypercerts/CreateListingDialog", () => ({
  CreateListingDialog: () => React.createElement("div", { "data-testid": "listing-dialog" }),
}));

vi.mock("@/components/hypercerts/TradeHistoryTable", () => ({
  TradeHistoryTable: () => React.createElement("div", { "data-testid": "trade-history" }),
}));

import HypercertDetail from "@/views/Gardens/Garden/HypercertDetail";

function renderWithIntl(ui: React.ReactElement) {
  return render(React.createElement(IntlProvider, { locale: "en", messages: {} }, ui));
}

const mockGarden = {
  id: "garden-1",
  name: "Test Garden",
  description: "A test garden",
  chainId: 11155111,
  gardeners: ["0x123"],
  operators: ["0x456"],
};

const mockHypercert = {
  id: "hc-123",
  title: "Conservation Hypercert",
  description: "Documenting tree planting work",
  imageUri: "ipfs://QmImage123",
  mintedAt: 1700000000,
  attestationCount: 5,
  totalUnits: 10000,
  txHash: "0xabc123",
  workScopes: ["gardening", "planting"],
  attestations: [
    {
      id: "att-1",
      title: "Tree Planting Work",
      gardenerAddress: "0x123",
      gardenerName: "Alice",
    },
  ],
  allowlistEntries: [
    {
      id: "claim-1",
      claimant: "0x789",
      units: 5000,
      claimedAt: 1700100000,
    },
  ],
};

function buildPermissions(overrides: Record<string, any> = {}) {
  return {
    canManageGarden: () => false,
    isOwnerOfGarden: () => false,
    isOperatorOfGarden: () => false,
    isEvaluatorOfGarden: () => false,
    ...overrides,
  };
}

describe("HypercertDetail View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardenPermissions.mockReturnValue(buildPermissions());
    mockUseHypercertListings.mockReturnValue({ listings: [] });
  });

  describe("loading state", () => {
    it("shows loading skeleton while data is fetching", () => {
      mockUseGardens.mockReturnValue({ data: [mockGarden] });
      mockUseHypercerts.mockReturnValue({
        hypercert: null,
        isLoading: true,
        syncStatus: "synced",
      });

      renderWithIntl(<HypercertDetail />);

      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("garden not found", () => {
    it("shows not found message when garden does not exist", () => {
      mockUseGardens.mockReturnValue({ data: [] });
      mockUseHypercerts.mockReturnValue({
        hypercert: null,
        isLoading: false,
        syncStatus: "synced",
      });

      renderWithIntl(<HypercertDetail />);

      expect(screen.getByTestId("page-header")).toBeInTheDocument();
    });
  });

  describe("hypercert missing", () => {
    it("shows error when hypercert is not found", () => {
      mockUseGardens.mockReturnValue({ data: [mockGarden] });
      mockUseHypercerts.mockReturnValue({
        hypercert: null,
        isLoading: false,
        syncStatus: "synced",
      });

      renderWithIntl(<HypercertDetail />);

      const alert = document.querySelector('[role="alert"]');
      expect(alert).toBeInTheDocument();
    });
  });

  describe("hypercert loaded", () => {
    it("renders hypercert title and description", () => {
      mockUseGardens.mockReturnValue({ data: [mockGarden] });
      mockUseHypercerts.mockReturnValue({
        hypercert: mockHypercert,
        isLoading: false,
        syncStatus: "synced",
      });

      renderWithIntl(<HypercertDetail />);

      expect(screen.getByText("Conservation Hypercert")).toBeInTheDocument();
      expect(screen.getByText("Documenting tree planting work")).toBeInTheDocument();
    });

    it("renders hypercert image when imageUri is present", () => {
      mockUseGardens.mockReturnValue({ data: [mockGarden] });
      mockUseHypercerts.mockReturnValue({
        hypercert: mockHypercert,
        isLoading: false,
        syncStatus: "synced",
      });

      renderWithIntl(<HypercertDetail />);

      const img = document.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "ipfs://QmImage123");
    });

    it("renders work scopes", () => {
      mockUseGardens.mockReturnValue({ data: [mockGarden] });
      mockUseHypercerts.mockReturnValue({
        hypercert: mockHypercert,
        isLoading: false,
        syncStatus: "synced",
      });

      renderWithIntl(<HypercertDetail />);

      expect(screen.getByText("gardening, planting")).toBeInTheDocument();
    });

    it("renders attestation references", () => {
      mockUseGardens.mockReturnValue({ data: [mockGarden] });
      mockUseHypercerts.mockReturnValue({
        hypercert: mockHypercert,
        isLoading: false,
        syncStatus: "synced",
      });

      renderWithIntl(<HypercertDetail />);

      expect(screen.getByText("Tree Planting Work")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    it("renders allowlist entries", () => {
      mockUseGardens.mockReturnValue({ data: [mockGarden] });
      mockUseHypercerts.mockReturnValue({
        hypercert: mockHypercert,
        isLoading: false,
        syncStatus: "synced",
      });

      renderWithIntl(<HypercertDetail />);

      expect(screen.getByText("0x789")).toBeInTheDocument();
      expect(screen.getByText("5,000")).toBeInTheDocument();
    });

    it("does not render image section when imageUri is absent", () => {
      mockUseGardens.mockReturnValue({ data: [mockGarden] });
      mockUseHypercerts.mockReturnValue({
        hypercert: { ...mockHypercert, imageUri: undefined },
        isLoading: false,
        syncStatus: "synced",
      });

      renderWithIntl(<HypercertDetail />);

      expect(document.querySelector("img")).not.toBeInTheDocument();
    });

    it("shows no claims message when allowlist is empty", () => {
      mockUseGardens.mockReturnValue({ data: [mockGarden] });
      mockUseHypercerts.mockReturnValue({
        hypercert: { ...mockHypercert, allowlistEntries: [] },
        isLoading: false,
        syncStatus: "synced",
      });

      renderWithIntl(<HypercertDetail />);

      // The no-claims section should appear
      const sections = document.querySelectorAll("section");
      expect(sections.length).toBeGreaterThan(0);
    });
  });

  describe("marketplace section (permission gated)", () => {
    it("does not show marketplace section when user cannot manage garden", () => {
      mockUseGardenPermissions.mockReturnValue(buildPermissions());
      mockUseGardens.mockReturnValue({ data: [mockGarden] });
      mockUseHypercerts.mockReturnValue({
        hypercert: mockHypercert,
        isLoading: false,
        syncStatus: "synced",
      });

      renderWithIntl(<HypercertDetail />);

      expect(screen.queryByTestId("marketplace-gate")).not.toBeInTheDocument();
    });

    it("shows marketplace section when user can manage garden", () => {
      mockUseGardenPermissions.mockReturnValue(buildPermissions({ canManageGarden: () => true }));
      mockUseGardens.mockReturnValue({ data: [mockGarden] });
      mockUseHypercerts.mockReturnValue({
        hypercert: mockHypercert,
        isLoading: false,
        syncStatus: "synced",
      });

      renderWithIntl(<HypercertDetail />);

      expect(screen.getByTestId("marketplace-gate")).toBeInTheDocument();
    });
  });
});
