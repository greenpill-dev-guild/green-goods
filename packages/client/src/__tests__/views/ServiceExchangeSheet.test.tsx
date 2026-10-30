/**
 * @vitest-environment happy-dom
 */

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { bookingStorySnapshot } from "../../../../shared/.storybook/voucherBookingFixtures";
import {
  VOUCHER_STORY_ISSUERS,
  vouchers,
} from "../../../../shared/.storybook/voucherPilotFixtures";
import {
  type ServiceExchangeQuote,
  ServiceExchangeSheet,
  type ServiceExchangeState,
} from "../../views/Home/Garden/Commitment/ServiceExchangeSheet";
import { exchangeQuoteFromPilot } from "../../views/Home/Garden/Commitment/serviceExchange";
import { renderWithProviders, screen } from "../test-utils";

const { greenGoods, techAndSun } = VOUCHER_STORY_ISSUERS;

/**
 * The rehearsal pool's quote: 2.044986 Tech and Sun vouchers price at 1.022493 Green Goods
 * vouchers before fees, a 2:1 rate, and 1 after the pool's and the protocol's fees.
 */
const QUOTE: ServiceExchangeQuote = {
  input: { amount: 2_044_986n, asset: techAndSun.asset, issuer: techAndSun, own: false },
  output: { amount: 1_000_000n, asset: greenGoods.asset, issuer: greenGoods },
  gross: 1_022_493n,
  poolFee: 20_449n,
  protocolFee: 2_044n,
  minimum: 1_000_000n,
  deadline: Date.UTC(2026, 9, 26, 14, 5) / 1000,
  held: 9_000_000n,
  available: 400_000n,
};

function open(
  state: ServiceExchangeState,
  onSmaller: (() => void) | null = null,
  quote: ServiceExchangeQuote = QUOTE
) {
  const handlers = { onRequote: vi.fn(), onBack: vi.fn() };
  renderWithProviders(
    <ServiceExchangeSheet
      open
      onOpenChange={() => undefined}
      quote={quote}
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
  it.each([
    "quote",
    "review",
  ] as const)("discloses the network in transaction details at the %s step", async (state) => {
    open(state);
    await userEvent.click(screen.getByText("Transaction details"));
    expect(screen.getByText(/One direct exchange in the shared pool on Gnosis/)).toBeVisible();
  });

  // The rate the quote prices at, with one whole voucher on its smaller side.
  it("shows the rate the quote prices at, not one voucher for one", () => {
    open("quote");
    expect(
      screen.getByText("2 Tech and Sun vouchers for 1 Green Goods voucher, before fees")
    ).toBeInTheDocument();
    expect(
      screen.getByText("The pilot's accepted ratio; it doesn't make the services equal in value")
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

  describe("between two members' vouchers (Maya to Teo)", () => {
    const asset = (token: `0x${string}`, symbol: string) => ({
      chainId: 100,
      token,
      symbol,
      decimals: 6,
    });
    /** Maya spends 2 of the 6 vouchers she issued for 1 of Teo's, at their agreed 2:1, no fees. */
    const MEMBER: ServiceExchangeQuote = {
      input: {
        amount: 2_000_000n,
        asset: asset("0x7777777777777777777777777777777777777777", "MAYA"),
        issuer: { name: "Maya Ruiz", gender: "feminine", kind: "individual" },
        own: true,
      },
      output: {
        amount: 1_000_000n,
        asset: asset("0x8888888888888888888888888888888888888888", "TEO"),
        issuer: { name: "Teo Alves", gender: "masculine", kind: "individual" },
      },
      gross: 1_000_000n,
      poolFee: 0n,
      protocolFee: 0n,
      minimum: 1_000_000n,
      deadline: Date.UTC(2026, 9, 26, 14, 5) / 1000,
      held: 6_000_000n,
      available: 2_000_000n,
    };

    it("gives the rate agreed for the offer, with no automatic 1:1", () => {
      open("quote", null, MEMBER);
      expect(screen.getByText("2 Maya Ruiz vouchers for 1 Teo Alves voucher")).toBeInTheDocument();
      expect(screen.getByText("Agreed per offer; no automatic 1:1")).toBeInTheDocument();
      expect(screen.queryByText(/pilot's accepted ratio/)).toBeNull();
    });

    it("says zero fees are proposed while the pool charges none of its own", () => {
      open("quote", null, MEMBER);
      expect(
        screen.getByText("Zero fees proposed; the pool may still charge a protocol fee")
      ).toBeInTheDocument();
      expect(screen.queryByText(/^Pool 0/)).toBeNull();
    });

    it("tells a member spending vouchers they issued that it promises their service", () => {
      open("quote", null, MEMBER);
      expect(screen.getByText("These are your own vouchers")).toBeInTheDocument();
      expect(
        screen.getByText("Spending them promises your service to whoever ends up holding them.")
      ).toBeInTheDocument();
    });

    // The output is one voucher and the fee none: each amount takes its own number's form.
    it("writes each amount in its own number, not the output's", () => {
      open("quote", null, MEMBER);
      expect(screen.getByText("0 Teo Alves vouchers")).toBeInTheDocument();
      expect(screen.queryByText("0 Teo Alves voucher")).toBeNull();
    });

    it("says nothing of your own vouchers to someone spending another member's", () => {
      open("quote", null, { ...MEMBER, input: { ...MEMBER.input, own: false } });
      expect(screen.queryByText("These are your own vouchers")).toBeNull();
    });
  });
});

// Spending vouchers you issued promises your own service to whoever holds them next.
describe("the rehearsal's quote, for the wallet that spends it", () => {
  it("marks the vouchers spent as the reader's own only when the reader issued them", () => {
    const quoted = bookingStorySnapshot("access", "notEnough", { exchange: "quoted" });
    const holder = (account: `0x${string}`) => ({
      account,
      issuers: [greenGoods, techAndSun],
      holdings: [{ issuer: techAndSun, available: vouchers(9) }],
    });

    // The story spends Tech and Sun vouchers: a holder's, unless Tech and Sun itself exchanges.
    const lina = exchangeQuoteFromPilot(quoted, holder(greenGoods.account));
    expect(lina?.input).toMatchObject({ issuer: techAndSun, own: false, amount: vouchers(8.01) });
    expect(lina?.held).toBe(vouchers(9));
    expect(exchangeQuoteFromPilot(quoted, holder(techAndSun.account))?.input.own).toBe(true);
  });
});
