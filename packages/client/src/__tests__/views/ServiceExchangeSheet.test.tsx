/**
 * @vitest-environment happy-dom
 */

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VOUCHER_STORY_ISSUERS } from "../../../../shared/.storybook/voucherPilotFixtures";
import {
  type ServiceExchangeQuote,
  ServiceExchangeSheet,
  type ServiceExchangeState,
} from "../../views/Home/Garden/Commitment/ServiceExchangeSheet";
import { renderWithProviders, screen } from "../test-utils";

const { greenGoods, techAndSun } = VOUCHER_STORY_ISSUERS;

/**
 * The rehearsal pool's quote: 2.044986 Tech and Sun vouchers price at 1.022493 Green Goods
 * vouchers before fees, a 2:1 rate, and 1 after the pool's and the protocol's fees.
 */
const QUOTE: ServiceExchangeQuote = {
  input: { amount: 2_044_986n, asset: techAndSun.asset, issuer: techAndSun },
  output: { amount: 1_000_000n, asset: greenGoods.asset, issuer: greenGoods },
  gross: 1_022_493n,
  poolFee: 20_449n,
  protocolFee: 2_044n,
  minimum: 1_000_000n,
  deadline: Date.UTC(2026, 9, 26, 14, 5) / 1000,
  held: 9_000_000n,
  available: 400_000n,
};

function open(state: ServiceExchangeState, onSmaller: (() => void) | null = null) {
  const handlers = { onRequote: vi.fn(), onBack: vi.fn() };
  renderWithProviders(
    <ServiceExchangeSheet
      open
      onOpenChange={() => undefined}
      quote={QUOTE}
      state={state}
      isPending={false}
      onReview={vi.fn()}
      onExchange={vi.fn()}
      onCheck={vi.fn()}
      onSmaller={onSmaller}
      {...handlers}
    />
  );
  return handlers;
}

describe("Exchange Vouchers", () => {
  it("shows the rate the quote prices at, not one voucher for one", () => {
    open("quote");
    expect(
      screen.getByText("1 Tech and Sun voucher for 0.5 Green Goods vouchers, before fees")
    ).toBeInTheDocument();
  });

  it("says an exchange that failed to transfer went nowhere, without calling the quote expired", async () => {
    const { onRequote } = open("failed");
    expect(screen.getByText("This exchange didn't go through")).toBeInTheDocument();
    expect(screen.queryByText("This quote expired")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Get a New Quote" }));
    expect(onRequote).toHaveBeenCalledTimes(1);
  });

  it("asks a short pool for the smaller exchange it can give", async () => {
    const onSmaller = vi.fn();
    const { onRequote } = open("short", onSmaller);
    await userEvent.click(screen.getByRole("button", { name: "Try a Smaller Amount" }));
    expect(onSmaller).toHaveBeenCalledTimes(1);
    expect(onRequote).not.toHaveBeenCalled();
  });

  it("offers only Back when nothing smaller fits the pool", () => {
    open("short");
    expect(screen.queryByRole("button", { name: "Try a Smaller Amount" })).toBeNull();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });
});
