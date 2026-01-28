/**
 * HypercertPreview Component Tests
 *
 * Tests for the hypercert preview step component.
 * Covers metadata display, minting states, and navigation.
 */

import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AllowlistEntry, HypercertMetadata, MintingState } from "@green-goods/shared";

// Mock dependencies
vi.mock("@green-goods/shared/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    DEFAULT_CHAIN_ID: 84532,
    getNetworkConfig: () => ({
      blockExplorer: "https://sepolia.basescan.org",
    }),
    copyToClipboard: vi.fn().mockResolvedValue(true),
    ImageWithFallback: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
      createElement("img", { src, alt, className, "data-testid": "hypercert-image" }),
  };
});

// Mock the DistributionChart and MintProgress components
vi.mock("../../../components/hypercerts/DistributionChart", () => ({
  DistributionChart: () => createElement("div", { "data-testid": "distribution-chart" }, "Chart"),
}));

vi.mock("../../../components/hypercerts/steps/MintProgress", () => ({
  MintProgress: ({ state }: { state: MintingState }) =>
    createElement(
      "div",
      { "data-testid": "mint-progress" },
      `Minting: ${state.status}`
    ),
}));

import { HypercertPreview } from "../../../components/hypercerts/steps/HypercertPreview";

// ============================================
// Test Fixtures
// ============================================

const TOTAL_UNITS = 100000000n;

function createMockMetadata(): HypercertMetadata {
  const now = Math.floor(Date.now() / 1000);
  return {
    name: "Conservation Impact Q4 2025",
    description: "Documenting conservation work across community gardens.",
    image: "ipfs://QmTestImage123456",
    hypercert: {
      work_scope: {
        name: "work_scope",
        value: ["tree planting", "habitat restoration"],
        display_value: "tree planting, habitat restoration",
      },
      impact_scope: {
        name: "impact_scope",
        value: ["biodiversity", "carbon sequestration"],
        display_value: "biodiversity, carbon sequestration",
      },
      work_timeframe: {
        name: "work_timeframe",
        value: [now - 86400 * 90, now],
        display_value: "Oct 1, 2025 - Dec 31, 2025",
      },
      impact_timeframe: {
        name: "impact_timeframe",
        value: [now - 86400 * 90, 0],
        display_value: "Ongoing",
      },
      contributors: {
        name: "contributors",
        value: ["0x1234567890123456789012345678901234567890"],
        display_value: "3 contributors",
      },
      rights: {
        name: "rights",
        value: ["Public display"],
        display_value: "Public display",
      },
    },
  };
}

function createMockAllowlist(): AllowlistEntry[] {
  return [
    {
      address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      units: 50000000n,
      label: "Alice",
    },
    {
      address: "0x2345678901234567890123456789012345678901" as `0x${string}`,
      units: 30000000n,
      label: "Bob",
    },
    {
      address: "0x3456789012345678901234567890123456789012" as `0x${string}`,
      units: 20000000n,
      label: "Charlie",
    },
  ];
}

function createMockMintingState(
  overrides: Partial<MintingState> = {}
): MintingState {
  return {
    status: "idle",
    metadataCid: null,
    allowlistCid: null,
    merkleRoot: null,
    userOpHash: null,
    txHash: null,
    hypercertId: null,
    error: null,
    ...overrides,
  };
}

describe("components/hypercerts/HypercertPreview", () => {
  const defaultProps = {
    metadata: createMockMetadata(),
    gardenName: "Test Community Garden",
    attestationCount: 5,
    totalUnits: TOTAL_UNITS,
    allowlist: createMockAllowlist(),
    mintingState: createMockMintingState(),
    chainId: 84532,
    onEditMetadata: vi.fn(),
    onEditDistribution: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("preview rendering", () => {
    it("renders hypercert title", () => {
      render(createElement(HypercertPreview, defaultProps));

      expect(screen.getByText("Conservation Impact Q4 2025")).toBeInTheDocument();
    });

    it("renders hypercert description", () => {
      render(createElement(HypercertPreview, defaultProps));

      expect(
        screen.getByText("Documenting conservation work across community gardens.")
      ).toBeInTheDocument();
    });

    it("renders hypercert image", () => {
      render(createElement(HypercertPreview, defaultProps));

      const image = screen.getByTestId("hypercert-image");
      expect(image).toHaveAttribute("src", "ipfs://QmTestImage123456");
    });

    it("renders garden name", () => {
      render(createElement(HypercertPreview, defaultProps));

      expect(screen.getByText("Test Community Garden")).toBeInTheDocument();
    });

    it("renders attestation count", () => {
      render(createElement(HypercertPreview, defaultProps));

      expect(screen.getByText(/5 attestations bundled/i)).toBeInTheDocument();
    });

    it("renders work scope", () => {
      render(createElement(HypercertPreview, defaultProps));

      expect(screen.getByText(/tree planting.*habitat restoration/i)).toBeInTheDocument();
    });

    it("renders impact scope", () => {
      render(createElement(HypercertPreview, defaultProps));

      expect(screen.getByText(/biodiversity.*carbon sequestration/i)).toBeInTheDocument();
    });

    it("renders work timeframe", () => {
      render(createElement(HypercertPreview, defaultProps));

      expect(screen.getByText(/Oct.*Dec/)).toBeInTheDocument();
    });

    it("renders total units", () => {
      render(createElement(HypercertPreview, defaultProps));

      expect(screen.getByText(/100,000,000|100000000/)).toBeInTheDocument();
    });
  });

  describe("distribution section", () => {
    it("renders distribution chart", () => {
      render(createElement(HypercertPreview, defaultProps));

      expect(screen.getByTestId("distribution-chart")).toBeInTheDocument();
    });

    it("renders allowlist table with recipients", () => {
      render(createElement(HypercertPreview, defaultProps));

      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });

    it("displays percentage for each recipient", () => {
      render(createElement(HypercertPreview, defaultProps));

      expect(screen.getByText("50.00%")).toBeInTheDocument();
      expect(screen.getByText("30.00%")).toBeInTheDocument();
      expect(screen.getByText("20.00%")).toBeInTheDocument();
    });

    it("does not render distribution section when allowlist is empty", () => {
      render(
        createElement(HypercertPreview, {
          ...defaultProps,
          allowlist: [],
        })
      );

      expect(screen.queryByTestId("distribution-chart")).not.toBeInTheDocument();
    });
  });

  describe("edit navigation", () => {
    it("shows Edit button for metadata section", () => {
      render(createElement(HypercertPreview, defaultProps));

      const editButtons = screen.getAllByText(/edit/i);
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it("calls onEditMetadata when metadata Edit clicked", async () => {
      const onEditMetadata = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(HypercertPreview, {
          ...defaultProps,
          onEditMetadata,
        })
      );

      // Find edit buttons - first ones are usually for metadata
      const editButtons = screen.getAllByText(/edit/i);
      await user.click(editButtons[0]);

      expect(onEditMetadata).toHaveBeenCalled();
    });

    it("calls onEditDistribution when distribution Edit clicked", async () => {
      const onEditDistribution = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(HypercertPreview, {
          ...defaultProps,
          onEditDistribution,
        })
      );

      // Find edit buttons - distribution edit is typically the last one
      const editButtons = screen.getAllByText(/edit/i);
      await user.click(editButtons[editButtons.length - 1]);

      expect(onEditDistribution).toHaveBeenCalled();
    });
  });

  describe("empty state", () => {
    it("shows empty message when metadata is null", () => {
      render(
        createElement(HypercertPreview, {
          ...defaultProps,
          metadata: null,
        })
      );

      // Should show empty state message
      expect(
        screen.getByText(/preview will appear once attestations are selected/i)
      ).toBeInTheDocument();
    });

    it("does not show preview card when metadata is null", () => {
      render(
        createElement(HypercertPreview, {
          ...defaultProps,
          metadata: null,
        })
      );

      expect(screen.queryByText("Conservation Impact Q4 2025")).not.toBeInTheDocument();
      expect(screen.queryByTestId("hypercert-image")).not.toBeInTheDocument();
    });
  });

  describe("minting state transitions", () => {
    // Note: MintProgress is now rendered in MintingDialog at the wizard level,
    // not inside HypercertPreview. The preview remains visible but is dimmed
    // when minting is in progress.

    it("shows dimmed preview when status is uploading_metadata", () => {
      const { container } = render(
        createElement(HypercertPreview, {
          ...defaultProps,
          mintingState: createMockMintingState({ status: "uploading_metadata" }),
        })
      );

      // Preview content remains visible
      expect(screen.getByText("Conservation Impact Q4 2025")).toBeInTheDocument();
      // Container has opacity class indicating dimming
      expect(container.querySelector(".opacity-60")).toBeInTheDocument();
    });

    it("shows dimmed preview when status is uploading_allowlist", () => {
      const { container } = render(
        createElement(HypercertPreview, {
          ...defaultProps,
          mintingState: createMockMintingState({ status: "uploading_allowlist" }),
        })
      );

      expect(screen.getByText("Conservation Impact Q4 2025")).toBeInTheDocument();
      expect(container.querySelector(".opacity-60")).toBeInTheDocument();
    });

    it("shows dimmed preview when status is pending", () => {
      const { container } = render(
        createElement(HypercertPreview, {
          ...defaultProps,
          mintingState: createMockMintingState({ status: "pending" }),
        })
      );

      expect(screen.getByText("Conservation Impact Q4 2025")).toBeInTheDocument();
      expect(container.querySelector(".opacity-60")).toBeInTheDocument();
    });

    it("shows full preview when status is confirmed", () => {
      const { container } = render(
        createElement(HypercertPreview, {
          ...defaultProps,
          mintingState: createMockMintingState({
            status: "confirmed",
            hypercertId: "12345",
            txHash: "0xabc123",
          }),
        })
      );

      expect(screen.getByText("Conservation Impact Q4 2025")).toBeInTheDocument();
      // Not dimmed when confirmed
      expect(container.querySelector(".opacity-60")).not.toBeInTheDocument();
    });

    it("shows full preview when status is failed", () => {
      const { container } = render(
        createElement(HypercertPreview, {
          ...defaultProps,
          mintingState: createMockMintingState({
            status: "failed",
            error: "Transaction reverted",
          }),
        })
      );

      expect(screen.getByText("Conservation Impact Q4 2025")).toBeInTheDocument();
      // Not dimmed when failed (user needs to see and interact)
      expect(container.querySelector(".opacity-60")).not.toBeInTheDocument();
    });

    it("shows full preview when status is idle", () => {
      const { container } = render(
        createElement(HypercertPreview, {
          ...defaultProps,
          mintingState: createMockMintingState({ status: "idle" }),
        })
      );

      expect(screen.getByText("Conservation Impact Q4 2025")).toBeInTheDocument();
      expect(container.querySelector(".opacity-60")).not.toBeInTheDocument();
    });
  });

  describe("impact timeframe display", () => {
    it("shows Ongoing when impact timeframe is indefinite", () => {
      render(createElement(HypercertPreview, defaultProps));

      expect(screen.getByText(/ongoing|indefinite/i)).toBeInTheDocument();
    });

    it("shows specific dates when impact timeframe has end date", () => {
      const metadataWithEndDate = createMockMetadata();
      metadataWithEndDate.hypercert.impact_timeframe.display_value = "Jan 1, 2026 - Dec 31, 2026";

      render(
        createElement(HypercertPreview, {
          ...defaultProps,
          metadata: metadataWithEndDate,
        })
      );

      expect(screen.getByText(/Jan.*Dec/)).toBeInTheDocument();
    });
  });

  describe("address display", () => {
    it("shows truncated addresses", () => {
      render(createElement(HypercertPreview, defaultProps));

      // Should show truncated format (0x1234...7890)
      expect(screen.getByText(/0x1234.*7890/)).toBeInTheDocument();
    });

    it("has copy buttons for addresses", () => {
      render(createElement(HypercertPreview, defaultProps));

      const copyButtons = screen.getAllByRole("button", { name: /copy/i });
      expect(copyButtons.length).toBeGreaterThan(0);
    });
  });

  describe("accessibility", () => {
    it("has accessible image alt text", () => {
      render(createElement(HypercertPreview, defaultProps));

      const image = screen.getByTestId("hypercert-image");
      expect(image).toHaveAttribute("alt");
      expect(image.getAttribute("alt")).not.toBe("");
    });

    it("edit buttons have accessible names", () => {
      render(createElement(HypercertPreview, defaultProps));

      const editButtons = screen.getAllByText(/edit/i);
      editButtons.forEach((button) => {
        expect(button.closest("button")).toBeInTheDocument();
      });
    });
  });
});
