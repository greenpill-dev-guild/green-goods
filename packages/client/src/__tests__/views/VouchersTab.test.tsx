/**
 * The wallet's Vouchers tab (PRD-1297 surface 4): what the account holds per issuer, a voucher
 * a booking holds as its own row that opens the booking at its garden, and a return on its way
 * as a pending row until it arrives.
 * @vitest-environment happy-dom
 */

import type { VoucherIssuer, VoucherWalletSnapshot } from "@green-goods/shared/commitment-pooling";
import { fireEvent, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render, screen } from "../test-utils";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));

// A booking row reads its offer's title; the title read has its own coverage.
vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal()),
  useCommitment: () => ({ commitment: { metadataCID: "bafy-hub-day" } }),
  useCommitmentMetadataFor: () => ({ version: 1, title: "Hub day, up to 4 hours" }),
}));

import { VouchersTab } from "../../views/Home/WalletSheet/VouchersTab";

const VOUCHER = 1_000_000n;
const ACCOUNT = "0x6666666666666666666666666666666666666666" as const;
const HUB = "0x7777777777777777777777777777777777777777" as const;
const COMMONS = "0x8888888888888888888888888888888888888888" as const;

const issuer = (
  name: string,
  account: `0x${string}`,
  gender: VoucherIssuer["gender"],
  garden: `0x${string}`
): VoucherIssuer => ({
  account,
  kind: "collective",
  name,
  gender,
  asset: { chainId: 100, token: account, symbol: null, decimals: 6 },
  garden,
  standing: { bookings: "open", exchange: "listed" },
});
const TECH_AND_SUN = issuer(
  "Tech and Sun",
  "0x5afe00000000000000000000000000000000a1b2",
  "feminine",
  HUB
);
const GREEN_GOODS = issuer(
  "Green Goods",
  "0x5afe00000000000000000000000000000000c3d4",
  "masculine",
  COMMONS
);

const ref = (commitmentId: bigint) => ({
  sourceChainId: 42161,
  coreModule: "0x000000000000000000000000000000000000f100" as const,
  commitmentId,
  garden: HUB,
  setupId: `0x${"a1".repeat(32)}` as const,
});

function wallet(overrides: Partial<VoucherWalletSnapshot> = {}): VoucherWalletSnapshot {
  return {
    account: ACCOUNT,
    evidence: "onchain",
    complete: true,
    reason: null,
    issuers: [TECH_AND_SUN, GREEN_GOODS],
    holdings: [
      { issuer: TECH_AND_SUN, available: 9n * VOUCHER },
      { issuer: GREEN_GOODS, available: 2n * VOUCHER },
    ],
    bookings: [],
    returns: [],
    ...overrides,
  };
}

describe("VouchersTab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows unavailable reads without claiming the account has no vouchers", () => {
    render(
      <VouchersTab
        wallet={wallet({
          evidence: "unavailable",
          reason: "canonical-read-unavailable",
          complete: false,
          issuers: [],
          holdings: [],
        })}
        onClose={() => {}}
      />
    );
    expect(
      screen.getByText(
        "Voucher balances and bookings could not be read. Check your connection and try again."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("No vouchers yet")).not.toBeInTheDocument();
  });
  it("lists each issuer's vouchers with what's available, and opens one in place to book from its garden", () => {
    const onClose = vi.fn();
    render(<VouchersTab wallet={wallet()} onClose={onClose} />);

    const row = screen.getByRole("button", { name: /Tech and Sun vouchers/ });
    expect(within(row).getByText("9")).toBeInTheDocument();
    expect(within(row).getByText("available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Green Goods vouchers/ })).toHaveTextContent("2");

    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Issued by")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Book a Service" }));
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(`/home/${HUB}`, { state: { from: "home" } });
  });

  it("shows a voucher a booking holds as its own row, which opens the booking at its garden", () => {
    const onClose = vi.fn();
    const booking = {
      booking: ref(1023n),
      issuer: TECH_AND_SUN.account,
      asset: TECH_AND_SUN.asset,
      agreed: VOUCHER,
      held: VOUCHER,
      stage: "held" as const,
    };
    render(<VouchersTab wallet={wallet({ bookings: [booking] })} onClose={onClose} />);

    const row = screen.getByRole("button", { name: /Hub day, up to 4 hours/ });
    expect(within(row).getByText("Booked")).toBeInTheDocument();
    expect(within(row).getByText("in a booking")).toBeInTheDocument();
    fireEvent.click(row);
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(`/home/${HUB}/commitments/1023`, {
      state: { from: "home" },
    });
  });

  it("shows a return on its way as a pending row until it arrives, not as a booking", () => {
    const settling = {
      booking: ref(1027n),
      issuer: GREEN_GOODS.account,
      asset: GREEN_GOODS.asset,
      agreed: 10n * VOUCHER,
      held: 6n * VOUCHER,
      stage: "settling" as const,
    };
    const back = {
      booking: ref(1027n),
      issuer: GREEN_GOODS.account,
      asset: GREEN_GOODS.asset,
      amount: 6n * VOUCHER,
      cause: "split" as const,
      state: "pending" as const,
      attempts: 0n,
    };
    const view = render(
      <VouchersTab wallet={wallet({ bookings: [settling], returns: [back] })} onClose={vi.fn()} />
    );

    const row = screen.getByRole("button", { name: /6 coming back/ });
    expect(within(row).getByText("Pending")).toBeInTheDocument();
    expect(screen.queryByText("Booked")).not.toBeInTheDocument();

    view.rerender(
      <VouchersTab
        wallet={wallet({ returns: [{ ...back, state: "failed", attempts: 1n }] })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Didn't go through")).toBeInTheDocument();
  });

  it("says the list may be missing something while the read can't see every booking", () => {
    render(<VouchersTab wallet={wallet({ complete: false })} onClose={vi.fn()} />);

    expect(screen.getByText(/may be missing a booking or a return/)).toBeInTheDocument();
  });

  it("leaves out an issuer the account holds none of, and says No vouchers yet when that is all", () => {
    const none = (of: VoucherIssuer) => ({ issuer: of, available: 0n });
    const view = render(
      <VouchersTab
        wallet={wallet({
          holdings: [{ issuer: TECH_AND_SUN, available: 9n * VOUCHER }, none(GREEN_GOODS)],
        })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /Tech and Sun vouchers/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Green Goods vouchers/ })).not.toBeInTheDocument();

    view.rerender(
      <VouchersTab
        wallet={wallet({ holdings: [none(TECH_AND_SUN), none(GREEN_GOODS)] })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("No vouchers yet")).toBeInTheDocument();
    expect(screen.queryByText("available")).not.toBeInTheDocument();
  });

  it("writes a booking's and a return's amounts in their own asset, listed issuer or not", () => {
    // An issuer the wallet no longer lists, whose vouchers carry no decimals.
    const retired = "0x5afe00000000000000000000000000000000e5f6" as const;
    const asset = { chainId: 100, token: retired, symbol: null, decimals: 0 };
    const booking = {
      booking: ref(1023n),
      issuer: retired,
      asset,
      agreed: 3n,
      held: 3n,
      stage: "held" as const,
    };
    const back = {
      booking: ref(1027n),
      issuer: retired,
      asset,
      amount: 2n,
      cause: "split" as const,
      state: "pending" as const,
      attempts: 0n,
    };
    render(
      <VouchersTab wallet={wallet({ bookings: [booking], returns: [back] })} onClose={vi.fn()} />
    );

    expect(
      within(screen.getByRole("button", { name: /Booked/ })).getByText("3")
    ).toBeInTheDocument();
    expect(screen.getByText("2 coming back")).toBeInTheDocument();
  });
});
