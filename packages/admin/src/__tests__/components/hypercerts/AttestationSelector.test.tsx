/**
 * AttestationSelector Component Tests
 *
 * Tests for the hypercert attestation selection step component.
 * Covers rendering, filtering, selection, and accessibility.
 */

import { screen, within } from "@testing-library/react";
import { renderWithProviders as render } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { HypercertAttestation } from "@green-goods/shared";

// Mock dependencies
vi.mock("@green-goods/shared/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    formatDateTime: (timestamp: number) => new Date(timestamp).toLocaleDateString(),
    ACTION_DOMAINS: ["biodiversity", "water", "soil", "carbon"],
  };
});

import { AttestationSelector } from "../../../components/hypercerts/steps/AttestationSelector";

// ============================================
// Test Fixtures
// ============================================

function createMockAttestation(overrides: Partial<HypercertAttestation> = {}): HypercertAttestation {
  const id = overrides.id ?? `0x${Math.random().toString(16).slice(2)}`;
  return {
    id,
    title: "Test Work Submission",
    gardenerAddress: "0x1234567890123456789012345678901234567890",
    gardenerName: "Alice Gardener",
    domain: "biodiversity",
    actionType: "planting",
    createdAt: Math.floor(Date.now() / 1000) - 86400,
    approvedAt: Math.floor(Date.now() / 1000),
    workScope: ["tree planting", "habitat restoration"],
    ...overrides,
  };
}

const mockAttestations: HypercertAttestation[] = [
  createMockAttestation({
    id: "0x1111",
    title: "Native Tree Planting",
    gardenerName: "Alice",
    domain: "biodiversity",
  }),
  createMockAttestation({
    id: "0x2222",
    title: "Rain Garden Installation",
    gardenerName: "Bob",
    domain: "water",
  }),
  createMockAttestation({
    id: "0x3333",
    title: "Compost System Setup",
    gardenerName: "Charlie",
    domain: "soil",
  }),
  createMockAttestation({
    id: "0x4444",
    title: "Carbon Sequestration Project",
    gardenerName: "Diana",
    domain: "carbon",
  }),
];

describe("components/hypercerts/AttestationSelector", () => {
  const defaultProps = {
    attestations: mockAttestations,
    selectedIds: [] as string[],
    onToggle: vi.fn(),
    isLoading: false,
    hasError: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders attestation cards", () => {
      render(createElement(AttestationSelector, defaultProps));

      expect(screen.getByText("Native Tree Planting")).toBeInTheDocument();
      expect(screen.getByText("Rain Garden Installation")).toBeInTheDocument();
      expect(screen.getByText("Compost System Setup")).toBeInTheDocument();
      expect(screen.getByText("Carbon Sequestration Project")).toBeInTheDocument();
    });

    it("displays attestation count", () => {
      render(createElement(AttestationSelector, defaultProps));

      // Should show "4 attestations available" or similar
      expect(screen.getByText(/4/)).toBeInTheDocument();
    });

    it("shows gardener names", () => {
      render(createElement(AttestationSelector, defaultProps));

      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
      expect(screen.getByText("Diana")).toBeInTheDocument();
    });

    it("displays domain badges", () => {
      render(createElement(AttestationSelector, defaultProps));

      // Check for domain labels (these would be translated in real app)
      const buttons = screen.getAllByRole("button", { pressed: false });
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe("loading state", () => {
    it("shows skeleton loaders when loading", () => {
      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          isLoading: true,
        })
      );

      // Should have loading indicator
      const loadingRegion = screen.getByRole("status");
      expect(loadingRegion).toHaveAttribute("aria-busy", "true");
    });

    it("does not render attestation cards when loading", () => {
      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          isLoading: true,
        })
      );

      expect(screen.queryByText("Native Tree Planting")).not.toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("shows error message when hasError is true", () => {
      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          hasError: true,
        })
      );

      // Should show error message (translated in real app)
      const errorElement = screen.getByRole("generic", { hidden: false });
      expect(errorElement).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty message when no attestations", () => {
      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          attestations: [],
        })
      );

      // Should show empty state message
      expect(screen.queryByText("Native Tree Planting")).not.toBeInTheDocument();
    });
  });

  describe("selection behavior", () => {
    it("calls onToggle when attestation is clicked", async () => {
      const onToggle = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          onToggle,
        })
      );

      const attestationCard = screen.getByText("Native Tree Planting").closest("button");
      expect(attestationCard).toBeInTheDocument();

      await user.click(attestationCard!);
      expect(onToggle).toHaveBeenCalledWith("0x1111");
    });

    it("shows selected state for selected attestations", () => {
      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          selectedIds: ["0x1111", "0x2222"],
        })
      );

      const selectedButtons = screen.getAllByRole("button", { pressed: true });
      expect(selectedButtons.length).toBe(2);
    });

    it("displays selection count when attestations selected", () => {
      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          selectedIds: ["0x1111", "0x2222"],
        })
      );

      // Should show "2 selected" or similar
      expect(screen.getByText(/2/)).toBeInTheDocument();
    });
  });

  describe("filtering", () => {
    it("filters by search query", async () => {
      const user = userEvent.setup();

      render(createElement(AttestationSelector, defaultProps));

      const searchInput = screen.getByRole("textbox");
      await user.type(searchInput, "Rain");

      // Only the matching attestation should be visible
      expect(screen.getByText("Rain Garden Installation")).toBeInTheDocument();
      expect(screen.queryByText("Native Tree Planting")).not.toBeInTheDocument();
    });

    it("filters by domain", async () => {
      const user = userEvent.setup();

      render(createElement(AttestationSelector, defaultProps));

      const domainSelect = screen.getByRole("combobox");
      await user.selectOptions(domainSelect, "water");

      // Only water domain attestation should be visible
      expect(screen.getByText("Rain Garden Installation")).toBeInTheDocument();
      expect(screen.queryByText("Native Tree Planting")).not.toBeInTheDocument();
    });

    it("combines search and domain filters", async () => {
      const user = userEvent.setup();

      render(createElement(AttestationSelector, defaultProps));

      const searchInput = screen.getByRole("textbox");
      const domainSelect = screen.getByRole("combobox");

      await user.selectOptions(domainSelect, "biodiversity");
      await user.type(searchInput, "Tree");

      expect(screen.getByText("Native Tree Planting")).toBeInTheDocument();
      expect(screen.queryByText("Rain Garden Installation")).not.toBeInTheDocument();
    });
  });

  describe("bulk selection", () => {
    it("shows Select All button", () => {
      render(createElement(AttestationSelector, defaultProps));

      expect(screen.getByText(/Select All/i)).toBeInTheDocument();
    });

    it("shows Deselect All button when some selected", () => {
      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          selectedIds: ["0x1111"],
        })
      );

      expect(screen.getByText(/Deselect All/i)).toBeInTheDocument();
    });

    it("calls onSelectAll when Select All clicked", async () => {
      const onSelectAll = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          onSelectAll,
        })
      );

      const selectAllButton = screen.getByText(/Select All/i);
      await user.click(selectAllButton);

      expect(onSelectAll).toHaveBeenCalled();
    });

    it("calls onDeselectAll when Deselect All clicked", async () => {
      const onDeselectAll = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          selectedIds: ["0x1111"],
          onDeselectAll,
        })
      );

      const deselectAllButton = screen.getByText(/Deselect All/i);
      await user.click(deselectAllButton);

      expect(onDeselectAll).toHaveBeenCalled();
    });
  });

  describe("bundled attestations", () => {
    it("shows bundled badge for already-bundled attestations", () => {
      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          bundledInfo: {
            "0x1111": { hypercertId: "hc-123", title: "Existing Hypercert" },
          },
        })
      );

      // The bundled attestation should show a different state
      const bundledCard = screen.getByText("Native Tree Planting").closest("button");
      expect(bundledCard).toHaveAttribute("aria-disabled", "true");
    });

    it("prevents selection of bundled attestations", async () => {
      const onToggle = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          onToggle,
          bundledInfo: {
            "0x1111": { hypercertId: "hc-123", title: "Existing Hypercert" },
          },
        })
      );

      const bundledCard = screen.getByText("Native Tree Planting").closest("button");
      await user.click(bundledCard!);

      // onToggle should NOT be called for bundled attestations
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("excludes bundled attestations from Select All", async () => {
      const onSelectAll = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          onSelectAll,
          bundledInfo: {
            "0x1111": { hypercertId: "hc-123", title: "Existing Hypercert" },
          },
        })
      );

      const selectAllButton = screen.getByText(/Select All/i);
      await user.click(selectAllButton);

      // Should only select non-bundled attestations
      expect(onSelectAll).toHaveBeenCalledWith(
        expect.not.arrayContaining(["0x1111"])
      );
    });
  });

  describe("accessibility", () => {
    it("has proper aria-pressed state for selection", () => {
      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          selectedIds: ["0x1111"],
        })
      );

      const selectedCard = screen.getByText("Native Tree Planting").closest("button");
      expect(selectedCard).toHaveAttribute("aria-pressed", "true");

      const unselectedCard = screen.getByText("Rain Garden Installation").closest("button");
      expect(unselectedCard).toHaveAttribute("aria-pressed", "false");
    });

    it("has proper aria-disabled state for bundled items", () => {
      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          bundledInfo: {
            "0x1111": { hypercertId: "hc-123", title: "Existing Hypercert" },
          },
        })
      );

      const bundledCard = screen.getByText("Native Tree Planting").closest("button");
      expect(bundledCard).toHaveAttribute("aria-disabled", "true");
    });

    it("has accessible loading state", () => {
      render(
        createElement(AttestationSelector, {
          ...defaultProps,
          isLoading: true,
        })
      );

      const loadingRegion = screen.getByRole("status");
      expect(loadingRegion).toHaveAttribute("aria-busy", "true");
      expect(loadingRegion).toHaveAttribute("aria-label");
    });

    it("search input has accessible label", () => {
      render(createElement(AttestationSelector, defaultProps));

      const searchInput = screen.getByRole("textbox");
      expect(searchInput).toHaveAccessibleName();
    });

    it("domain filter has accessible label", () => {
      render(createElement(AttestationSelector, defaultProps));

      const domainSelect = screen.getByRole("combobox");
      expect(domainSelect).toHaveAccessibleName();
    });
  });
});
