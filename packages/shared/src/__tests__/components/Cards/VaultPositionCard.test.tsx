/**
 * VaultPositionCard Tests
 * @vitest-environment jsdom
 *
 * Tests the vault position display card renders all financial data correctly.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VaultPositionCard } from "../../../components/Cards/VaultPositionCard";

describe("VaultPositionCard", () => {
  const defaultProps = {
    gardenName: "Quito Reforestation",
    deposited: "1,000.00",
    currentValue: "1,050.25",
    apy: "12.5%",
    tokenSymbol: "USDC",
  };

  it("renders garden name", () => {
    render(<VaultPositionCard {...defaultProps} />);

    expect(screen.getByText("Quito Reforestation")).toBeInTheDocument();
  });

  it("renders deposited amount with token symbol", () => {
    render(<VaultPositionCard {...defaultProps} />);

    expect(screen.getByText("1,000.00 USDC")).toBeInTheDocument();
  });

  it("renders current value", () => {
    render(<VaultPositionCard {...defaultProps} />);

    expect(screen.getByText("1,050.25 USDC")).toBeInTheDocument();
  });

  it("renders APY percentage", () => {
    render(<VaultPositionCard {...defaultProps} />);

    expect(screen.getByText("12.5%")).toBeInTheDocument();
  });

  it("truncates long garden names with title tooltip attribute", () => {
    const longName = "Incredibly Long Garden Name That Should Be Truncated In The Card Display";
    render(<VaultPositionCard {...defaultProps} gardenName={longName} />);

    const nameElement = screen.getByText(longName);
    expect(nameElement).toHaveAttribute("title", longName);
    expect(nameElement.className).toContain("truncate");
  });
});
