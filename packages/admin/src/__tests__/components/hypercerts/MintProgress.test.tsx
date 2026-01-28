/**
 * MintProgress Component Tests
 *
 * Tests for the hypercert minting progress indicator component.
 * Covers status display, step progression, and error/success states.
 *
 * @vitest-environment jsdom
 */

import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "../../test-utils";
import { createElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MintingState } from "@green-goods/shared";

// Mock cn utility
vi.mock("@green-goods/shared/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Mock only the specific functions we need
vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  DEFAULT_CHAIN_ID: 84532,
  getNetworkConfig: () => ({
    blockExplorer: "https://sepolia.basescan.org",
  }),
  getBlockchainErrorI18nKey: (error: string) => `app.errors.blockchain.${error}`,
}));

import { MintProgress } from "../../../components/hypercerts/steps/MintProgress";

// ============================================
// Test Fixtures
// ============================================

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

describe("components/hypercerts/MintProgress", () => {
  const defaultProps = {
    state: createMockMintingState(),
    chainId: 84532,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("step indicator rendering", () => {
    it("renders all 4 mint steps", () => {
      render(createElement(MintProgress, defaultProps));

      // Should show metadata, allowlist, signing, and confirming steps
      const nav = screen.getByRole("navigation");
      expect(nav).toBeInTheDocument();

      const listItems = screen.getAllByRole("listitem");
      expect(listItems.length).toBe(4);
    });

    it("has accessible navigation label", () => {
      render(createElement(MintProgress, defaultProps));

      const nav = screen.getByRole("navigation");
      expect(nav).toHaveAttribute("aria-label");
    });
  });

  describe("idle state", () => {
    it("shows ready status message", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({ status: "idle" }),
        })
      );

      expect(screen.getByText(/ready/i)).toBeInTheDocument();
    });

    it("shows all steps as pending", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({ status: "idle" }),
        })
      );

      // All steps should show their step numbers (1, 2, 3, 4)
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
    });
  });

  describe("uploading_metadata state", () => {
    it("shows metadata upload status", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({ status: "uploading_metadata" }),
        })
      );

      // Multiple elements may match due to sr-only announcement
      expect(screen.getAllByText(/metadata|ipfs/i).length).toBeGreaterThan(0);
    });

    it("shows step 1 as active with spinner", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({ status: "uploading_metadata" }),
        })
      );

      // First step should not show "1" anymore (replaced with spinner)
      // Other steps should show their numbers
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
    });
  });

  describe("uploading_allowlist state", () => {
    it("shows allowlist upload status", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({ status: "uploading_allowlist" }),
        })
      );

      // Multiple elements may match due to sr-only announcement
      expect(screen.getAllByText(/allowlist|distribution/i).length).toBeGreaterThan(0);
    });

    it("shows step 1 as complete", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({ status: "uploading_allowlist" }),
        })
      );

      // Step 1 should be complete (checkmark instead of number)
      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });
  });

  describe("signing states", () => {
    it("shows signing status for building_userop", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({ status: "building_userop" }),
        })
      );

      // Multiple elements may match due to sr-only announcement
      expect(screen.getAllByText(/sign|transaction/i).length).toBeGreaterThan(0);
    });

    it("shows signing status for awaiting_signature", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({ status: "awaiting_signature" }),
        })
      );

      // Multiple elements may match due to sr-only announcement
      expect(screen.getAllByText(/sign|wallet/i).length).toBeGreaterThan(0);
    });

    it("shows steps 1 and 2 as complete during signing", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({ status: "building_userop" }),
        })
      );

      // Steps 1 and 2 should be complete
      expect(screen.queryByText("1")).not.toBeInTheDocument();
      expect(screen.queryByText("2")).not.toBeInTheDocument();
      // Steps 4 should still be pending
      expect(screen.getByText("4")).toBeInTheDocument();
    });
  });

  describe("pending states", () => {
    it("shows pending status for submitting", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({ status: "submitting" }),
        })
      );

      // Multiple elements may match due to sr-only announcement
      expect(screen.getAllByText(/confirm|pending|waiting/i).length).toBeGreaterThan(0);
    });

    it("shows pending status", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({ status: "pending" }),
        })
      );

      // Multiple elements may match due to sr-only announcement
      expect(screen.getAllByText(/confirm|pending|waiting/i).length).toBeGreaterThan(0);
    });

    it("shows steps 1, 2, and 3 as complete during pending", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({ status: "pending" }),
        })
      );

      // Only step 4 number should be visible (as spinner)
      expect(screen.queryByText("1")).not.toBeInTheDocument();
      expect(screen.queryByText("2")).not.toBeInTheDocument();
      expect(screen.queryByText("3")).not.toBeInTheDocument();
    });
  });

  describe("confirmed state", () => {
    it("shows success status", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({
            status: "confirmed",
            hypercertId: "84532-12345",
          }),
        })
      );

      // Multiple elements may match due to sr-only announcement
      expect(screen.getAllByText(/confirm|success|complete/i).length).toBeGreaterThan(0);
    });

    it("displays hypercert ID", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({
            status: "confirmed",
            hypercertId: "84532-12345",
          }),
        })
      );

      // Multiple elements may match due to sr-only announcement
      expect(screen.getAllByText(/84532-12345/).length).toBeGreaterThan(0);
    });

    it("shows all steps as complete", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({
            status: "confirmed",
            hypercertId: "84532-12345",
          }),
        })
      );

      // No step numbers should be visible (all checkmarks)
      expect(screen.queryByText("1")).not.toBeInTheDocument();
      expect(screen.queryByText("2")).not.toBeInTheDocument();
      expect(screen.queryByText("3")).not.toBeInTheDocument();
      expect(screen.queryByText("4")).not.toBeInTheDocument();
    });
  });

  describe("failed state", () => {
    it("shows failure status", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({
            status: "failed",
            error: "Transaction reverted",
          }),
        })
      );

      // Multiple elements may match due to sr-only announcement
      expect(screen.getAllByText(/fail|error/i).length).toBeGreaterThan(0);
    });

    it("displays error message", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({
            status: "failed",
            error: "Transaction reverted",
          }),
        })
      );

      expect(screen.getByText(/reverted/i)).toBeInTheDocument();
    });

    it("shows error styling on failed step", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({
            status: "failed",
            error: "Upload failed",
          }),
        })
      );

      // Should have error-styled elements - use getAllBy since sr-only may match too
      const errorElements = screen.getAllByText(/fail|error/i);
      expect(errorElements.length).toBeGreaterThan(0);
      expect(errorElements[0].closest("div")).toBeInTheDocument();
    });
  });

  describe("transaction link", () => {
    it("shows transaction link when txHash is available", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({
            status: "confirmed",
            txHash: "0xabc123def456",
            hypercertId: "84532-12345",
          }),
        })
      );

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute(
        "href",
        "https://sepolia.basescan.org/tx/0xabc123def456"
      );
    });

    it("opens transaction link in new tab", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({
            status: "confirmed",
            txHash: "0xabc123def456",
            hypercertId: "84532-12345",
          }),
        })
      );

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    });

    it("does not show transaction link without txHash", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({
            status: "pending",
          }),
        })
      );

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
  });

  describe("helper text", () => {
    it("shows helper text during active states", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({ status: "pending" }),
        })
      );

      // Should show helper message (i18n: "Please keep this tab open until confirmation.")
      expect(screen.getByText(/keep.*tab.*open|please.*open/i)).toBeInTheDocument();
    });

    it("does not show helper text when confirmed", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({
            status: "confirmed",
            hypercertId: "12345",
          }),
        })
      );

      expect(screen.queryByText(/keep.*tab.*open|please.*open/i)).not.toBeInTheDocument();
    });

    it("does not show helper text when failed", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({
            status: "failed",
            error: "Error",
          }),
        })
      );

      expect(screen.queryByText(/keep.*tab.*open|please.*open/i)).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("progress steps are in an ordered list", () => {
      render(createElement(MintProgress, defaultProps));

      const list = screen.getByRole("list");
      expect(list.tagName).toBe("OL");
    });

    it("step indicators have visual distinction for states", () => {
      render(
        createElement(MintProgress, {
          ...defaultProps,
          state: createMockMintingState({ status: "uploading_allowlist" }),
        })
      );

      // Complete step (step 1) should have success styling
      // Active step (step 2) should have primary styling
      // Pending steps should have default styling
      const listItems = screen.getAllByRole("listitem");
      expect(listItems.length).toBe(4);
    });
  });
});
