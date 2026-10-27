import type {
  CommitmentRewardOutcome,
  CommitmentVoucherOutcomes as Outcomes,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { Address } from "@green-goods/shared/types/domain";
import { describe, expect, it } from "vitest";
import { CommitmentVoucherOutcomes } from "@/views/Garden/Pool/CommitmentDialog/CommitmentVoucherOutcomes";
import { renderWithProviders, screen, within } from "../test-utils";

const TECH_AND_SUN = "0x000000000000000000000000000000000000fb02" as Address;
const VOUCHERS = {
  chainId: 100,
  token: "0x000000000000000000000000000000000000fb01" as Address,
  symbol: "TEST-B",
  decimals: 6,
};
const voucherReward = (over: Partial<CommitmentRewardOutcome> = {}): CommitmentRewardOutcome => ({
  id: "0x01",
  kind: "voucher",
  asset: VOUCHERS,
  amount: 1_000_000n,
  funder: TECH_AND_SUN,
  status: "on-the-way",
  shortOf: null,
  receipt: null,
  attempts: 0n,
  issuer: { name: "Tech and Sun", gender: "feminine" },
  ...over,
});
const gdReward: CommitmentRewardOutcome = {
  id: "0x02",
  kind: "gd",
  asset: {
    chainId: 42220,
    token: "0x000000000000000000000000000000000000fd01" as Address,
    symbol: "G$",
    decimals: 18,
  },
  amount: 100n * 10n ** 18n,
  funder: "0x000000000000000000000000000000000000fd02" as Address,
  status: "received",
  shortOf: null,
  receipt: "0xfeed",
  attempts: 1n,
  issuer: null,
};
const request = (rewards: CommitmentRewardOutcome[]): Outcomes => ({
  rewards,
  workFulfilled: true,
  payment: null,
});

describe("CommitmentVoucherOutcomes", () => {
  it("lists each reward on its own, the vouchers first, each with its own state and receipt", () => {
    renderWithProviders(
      <CommitmentVoucherOutcomes
        outcomes={request([voucherReward({ status: "waiting", shortOf: "allowance" }), gdReward])}
      />
    );
    const section = screen.getByRole("region", { name: "Rewards" });
    const rows = Array.from(section.querySelectorAll("[data-reward]"));

    expect(
      rows.map((row) => [row.getAttribute("data-reward"), row.getAttribute("data-status")])
    ).toEqual([
      ["voucher", "waiting"],
      ["gd", "received"],
    ]);
    expect(rows[0]).toHaveTextContent("1 Tech and Sun voucher");
    expect(rows[0]).toHaveTextContent("Waiting");
    expect(rows[0]).toHaveTextContent(
      "Waits for Tech and Sun to raise the allowance. It isn’t lost."
    );
    expect(rows[1]).toHaveTextContent("100 G$");
    expect(rows[1]).toHaveTextContent("Received");
    expect(rows[1]).toHaveTextContent("Paid on Celo");
    const receipts = within(section.querySelector("details")!).getAllByRole("listitem");
    expect(receipts.map((item) => item.textContent)).toEqual([
      "Vouchers: no receipt yet",
      "G$: 0xfeed",
    ]);
    expect(screen.queryByRole("region", { name: "Voucher Payment" })).not.toBeInTheDocument();
  });

  it("says a short reserve apart from a short allowance, naming an unlisted issuer by its token", () => {
    renderWithProviders(
      <CommitmentVoucherOutcomes
        outcomes={request([voucherReward({ status: "waiting", shortOf: "reserve", issuer: null })])}
      />
    );
    const row = screen.getByRole("region", { name: "Rewards" }).querySelector("[data-reward]");

    expect(row).toHaveTextContent("1 TEST-B voucher");
    expect(row).toHaveTextContent("Waits for TEST-B to top up its reserve. It isn’t lost.");
  });

  it("before the work is confirmed, says where each reward will come from and sets nothing aside", () => {
    renderWithProviders(
      <CommitmentVoucherOutcomes
        outcomes={{
          ...request([
            voucherReward({ status: "after-work" }),
            { ...gdReward, status: "after-work", receipt: null },
          ]),
          workFulfilled: false,
        }}
      />
    );
    const section = screen.getByRole("region", { name: "Rewards" });
    const [vouchers, gd] = Array.from(section.querySelectorAll("[data-reward]"));

    expect(section).toHaveAttribute("data-state", "after-work");
    expect(section).toHaveTextContent("Nothing is set aside before the work is confirmed.");
    expect(vouchers).toHaveTextContent("After the work");
    expect(vouchers).toHaveTextContent("From Tech and Sun’s reserve once the work is confirmed");
    expect(gd).toHaveTextContent("After the work");
    expect(gd).toHaveTextContent("Paid on Celo by the payout plan once the work is confirmed");
  });

  it("shows an offer's voucher payment under its terms version, and no rewards", () => {
    const offer = (payment: Partial<NonNullable<Outcomes["payment"]>>): Outcomes => ({
      rewards: [],
      workFulfilled: false,
      payment: {
        asset: VOUCHERS,
        issuer: { name: "Tech and Sun", gender: "feminine" },
        issuerAccount: TECH_AND_SUN,
        units: 1_000_000n,
        revision: 2n,
        ...payment,
      },
    });
    const { rerender } = renderWithProviders(<CommitmentVoucherOutcomes outcomes={offer({})} />);
    const payment = () => screen.getByRole("region", { name: "Voucher Payment" });

    expect(payment()).toHaveTextContent("A booking takes1 Tech and Sun voucher");
    expect(payment()).toHaveTextContent("TermsVersion 2");
    expect(screen.queryByRole("region", { name: "Rewards" })).not.toBeInTheDocument();

    // An issuer with no listed name and no token symbol is named by its account, never a blank.
    rerender(
      <CommitmentVoucherOutcomes
        outcomes={offer({ issuer: null, asset: { ...VOUCHERS, symbol: null } })}
      />
    );
    expect(payment()).toHaveTextContent("A booking takes1 0x0000…fb02 voucher");
  });
});
