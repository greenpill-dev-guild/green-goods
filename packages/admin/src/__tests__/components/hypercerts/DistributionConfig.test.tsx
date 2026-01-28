/**
 * DistributionConfig Component Tests
 *
 * Tests for the hypercert distribution configuration step component.
 * Covers mode selection, allowlist editing, validation, and accessibility.
 */

import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AllowlistEntry, DistributionMode } from "@green-goods/shared";

// Mock dependencies
vi.mock("@green-goods/shared/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    TOTAL_UNITS: 100000000n,
    copyToClipboard: vi.fn().mockResolvedValue(true),
    sumUnits: (entries: AllowlistEntry[]) =>
      entries.reduce((sum, e) => sum + e.units, 0n),
  };
});

// Mock the DistributionChart component
vi.mock("../../../components/hypercerts/DistributionChart", () => ({
  DistributionChart: ({ allowlist, totalUnits }: { allowlist: AllowlistEntry[]; totalUnits: bigint }) =>
    createElement(
      "div",
      { "data-testid": "distribution-chart" },
      `Chart: ${allowlist.length} entries, ${totalUnits.toString()} units`
    ),
}));

import { DistributionConfig } from "../../../components/hypercerts/steps/DistributionConfig";

// ============================================
// Test Fixtures
// ============================================

const TOTAL_UNITS = 100000000n;

function createMockAllowlist(count: number = 3): AllowlistEntry[] {
  const addresses = [
    "0x1234567890123456789012345678901234567890",
    "0x2345678901234567890123456789012345678901",
    "0x3456789012345678901234567890123456789012",
    "0x4567890123456789012345678901234567890123",
    "0x5678901234567890123456789012345678901234",
  ];

  const unitsPerEntry = TOTAL_UNITS / BigInt(count);
  const remainder = TOTAL_UNITS % BigInt(count);

  return addresses.slice(0, count).map((address, index) => ({
    address: address as `0x${string}`,
    units: index === 0 ? unitsPerEntry + remainder : unitsPerEntry,
    label: `Contributor ${index + 1}`,
  }));
}

describe("components/hypercerts/DistributionConfig", () => {
  const defaultProps = {
    mode: "equal" as DistributionMode,
    allowlist: createMockAllowlist(3),
    totalUnits: TOTAL_UNITS,
    onModeChange: vi.fn(),
    onAllowlistChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders distribution mode buttons", () => {
      render(createElement(DistributionConfig, defaultProps));

      expect(screen.getByText(/equal/i)).toBeInTheDocument();
      expect(screen.getByText(/proportional|count/i)).toBeInTheDocument();
      expect(screen.getByText(/value/i)).toBeInTheDocument();
      expect(screen.getByText(/custom/i)).toBeInTheDocument();
    });

    it("renders allowlist table", () => {
      render(createElement(DistributionConfig, defaultProps));

      expect(screen.getByText(/recipient/i)).toBeInTheDocument();
      expect(screen.getByText(/units/i)).toBeInTheDocument();
      expect(screen.getByText(/percent/i)).toBeInTheDocument();
    });

    it("renders distribution chart when allowlist has entries", () => {
      render(createElement(DistributionConfig, defaultProps));

      expect(screen.getByTestId("distribution-chart")).toBeInTheDocument();
    });

    it("displays contributor labels", () => {
      render(createElement(DistributionConfig, defaultProps));

      expect(screen.getByText("Contributor 1")).toBeInTheDocument();
      expect(screen.getByText("Contributor 2")).toBeInTheDocument();
      expect(screen.getByText("Contributor 3")).toBeInTheDocument();
    });

    it("displays truncated addresses", () => {
      render(createElement(DistributionConfig, defaultProps));

      // Should show truncated address format (0x1234...7890)
      expect(screen.getByText(/0x1234.*7890/)).toBeInTheDocument();
    });

    it("displays percentage for each entry", () => {
      render(createElement(DistributionConfig, defaultProps));

      // With 3 equal entries, each should be ~33.33%
      const percentages = screen.getAllByText(/\d+\.\d+%/);
      expect(percentages.length).toBe(3);
    });
  });

  describe("mode selection", () => {
    it("highlights current mode", () => {
      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "equal",
        })
      );

      const equalButton = screen.getByText(/equal/i).closest("button");
      // The selected mode should have different styling
      expect(equalButton?.className).toContain("primary");
    });

    it("calls onModeChange when mode button clicked", async () => {
      const onModeChange = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          onModeChange,
        })
      );

      const customButton = screen.getByText(/custom/i);
      await user.click(customButton);

      expect(onModeChange).toHaveBeenCalledWith("custom");
    });

    it("switches between all distribution modes", async () => {
      const onModeChange = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          onModeChange,
        })
      );

      // Test each mode
      const modes = ["equal", "count", "value", "custom"];
      for (const mode of modes) {
        const button = screen.getByText(new RegExp(mode, "i"));
        await user.click(button);
        expect(onModeChange).toHaveBeenCalledWith(mode);
      }
    });
  });

  describe("custom mode editing", () => {
    it("shows editable address inputs in custom mode", () => {
      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "custom",
        })
      );

      const addressInputs = screen.getAllByRole("textbox");
      expect(addressInputs.length).toBeGreaterThan(0);
    });

    it("shows remove buttons in custom mode", () => {
      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "custom",
        })
      );

      const removeButtons = screen.getAllByRole("button", { name: /remove/i });
      expect(removeButtons.length).toBe(3);
    });

    it("shows Add Recipient button in custom mode", () => {
      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "custom",
        })
      );

      expect(screen.getByText(/add recipient/i)).toBeInTheDocument();
    });

    it("calls onAllowlistChange when units edited", async () => {
      const onAllowlistChange = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "custom",
          onAllowlistChange,
        })
      );

      const unitsInputs = screen.getAllByRole("textbox");
      const firstUnitsInput = unitsInputs.find(
        (input) => (input as HTMLInputElement).value.includes("33")
      );

      if (firstUnitsInput) {
        await user.clear(firstUnitsInput);
        await user.type(firstUnitsInput, "50000000");
        expect(onAllowlistChange).toHaveBeenCalled();
      }
    });

    it("calls onAllowlistChange when address edited", async () => {
      const onAllowlistChange = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "custom",
          onAllowlistChange,
        })
      );

      const addressInputs = screen.getAllByRole("textbox");
      const firstAddressInput = addressInputs[0];

      await user.clear(firstAddressInput);
      await user.type(firstAddressInput, "0x9999999999999999999999999999999999999999");

      expect(onAllowlistChange).toHaveBeenCalled();
    });

    it("removes recipient when remove button clicked", async () => {
      const onAllowlistChange = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "custom",
          onAllowlistChange,
        })
      );

      const removeButtons = screen.getAllByRole("button", { name: /remove/i });
      await user.click(removeButtons[0]);

      expect(onAllowlistChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: "Contributor 2" }),
          expect.objectContaining({ label: "Contributor 3" }),
        ])
      );
    });

    it("adds recipient when Add Recipient clicked", async () => {
      const onAllowlistChange = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "custom",
          onAllowlistChange,
        })
      );

      const addButton = screen.getByText(/add recipient/i);
      await user.click(addButton);

      expect(onAllowlistChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          ...defaultProps.allowlist,
          expect.objectContaining({ units: 0n }),
        ])
      );
    });
  });

  describe("non-custom mode behavior", () => {
    it("disables unit inputs in equal mode", () => {
      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "equal",
        })
      );

      const unitsInputs = screen
        .getAllByRole("textbox")
        .filter((input) => input.getAttribute("aria-label")?.includes("units"));

      unitsInputs.forEach((input) => {
        expect(input).toBeDisabled();
      });
    });

    it("does not show remove buttons in non-custom mode", () => {
      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "equal",
        })
      );

      const removeButtons = screen.queryAllByRole("button", { name: /remove/i });
      expect(removeButtons.length).toBe(0);
    });

    it("does not show Add Recipient button in non-custom mode", () => {
      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "equal",
        })
      );

      expect(screen.queryByText(/add recipient/i)).not.toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("shows error when total units do not match", () => {
      const invalidAllowlist = [
        {
          address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
          units: 50000000n, // Only half the required units
          label: "Contributor 1",
        },
      ];

      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          allowlist: invalidAllowlist,
        })
      );

      // Should show mismatch error
      expect(screen.getByText(/mismatch|total/i)).toBeInTheDocument();
    });

    it("shows error when units are non-positive", () => {
      const invalidAllowlist = [
        {
          address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
          units: 0n,
          label: "Contributor 1",
        },
        {
          address: "0x2345678901234567890123456789012345678901" as `0x${string}`,
          units: TOTAL_UNITS,
          label: "Contributor 2",
        },
      ];

      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          allowlist: invalidAllowlist,
        })
      );

      // Should show non-positive error
      expect(screen.getByText(/non-positive|zero|positive/i)).toBeInTheDocument();
    });

    it("shows error when allowlist is empty", () => {
      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          allowlist: [],
        })
      );

      // Should show empty error
      expect(screen.getByText(/empty/i)).toBeInTheDocument();
    });

    it("shows invalid address error in custom mode", () => {
      const invalidAllowlist = [
        {
          address: "invalid-address" as `0x${string}`,
          units: TOTAL_UNITS,
          label: "Bad Address",
        },
      ];

      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "custom",
          allowlist: invalidAllowlist,
        })
      );

      // Should show invalid address error
      expect(screen.getByText(/invalid.*address/i)).toBeInTheDocument();
    });

    it("does not show error when distribution is valid", () => {
      render(createElement(DistributionConfig, defaultProps));

      // Should not show any error messages
      expect(screen.queryByText(/error|mismatch|invalid/i)).not.toBeInTheDocument();
    });
  });

  describe("total display", () => {
    it("displays total units", () => {
      render(createElement(DistributionConfig, defaultProps));

      // Should show the total
      expect(screen.getByText(/100,000,000|100000000/)).toBeInTheDocument();
    });
  });

  describe("copy address functionality", () => {
    it("shows copy button for addresses in non-custom mode", () => {
      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "equal",
        })
      );

      const copyButtons = screen.getAllByRole("button", { name: /copy/i });
      expect(copyButtons.length).toBeGreaterThan(0);
    });
  });

  describe("accessibility", () => {
    it("has accessible labels for unit inputs", () => {
      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "custom",
        })
      );

      const unitsInputs = screen
        .getAllByRole("textbox")
        .filter((input) => input.getAttribute("aria-label"));

      expect(unitsInputs.length).toBeGreaterThan(0);
    });

    it("has accessible labels for address inputs in custom mode", () => {
      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "custom",
        })
      );

      const addressInputs = screen
        .getAllByRole("textbox")
        .filter((input) => input.getAttribute("aria-label")?.includes("recipient"));

      expect(addressInputs.length).toBeGreaterThan(0);
    });

    it("has accessible labels for remove buttons", () => {
      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "custom",
        })
      );

      const removeButtons = screen.getAllByRole("button", { name: /remove/i });
      removeButtons.forEach((button) => {
        expect(button).toHaveAccessibleName();
      });
    });

    it("indicates invalid state with aria-invalid", () => {
      const invalidAllowlist = [
        {
          address: "invalid" as `0x${string}`,
          units: TOTAL_UNITS,
          label: "Bad",
        },
      ];

      render(
        createElement(DistributionConfig, {
          ...defaultProps,
          mode: "custom",
          allowlist: invalidAllowlist,
        })
      );

      const invalidInput = screen.getByRole("textbox", {
        name: /recipient/i,
      });
      expect(invalidInput).toHaveAttribute("aria-invalid", "true");
    });
  });
});
