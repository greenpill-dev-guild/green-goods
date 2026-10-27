/**
 * The steward's voucher console, as decisions: where a booking asked in the
 * pool stands, whether the pool's steward may accept it, and whether a
 * proposed return or a raised allowance stays inside the issuer's terms. The
 * acceptance checks mirror what `acceptServiceClaim` enforces on chain, so the
 * cockpit never offers an Accept the contract would refuse.
 */

import { describe, expect, it } from "vitest";

import type { Address } from "../types/domain";
import {
  type IssuerSafeThreshold,
  parseVoucherAmount,
  selectAllowanceRaise,
  selectCanApproveBooking,
  selectReturnProposal,
  selectVoucherAcceptanceChecks,
  selectVoucherAskStage,
  type VoucherAsk,
} from "../modules/commitment-pooling/voucher-console";

const NOW = 1_761_600_000;
const DAY = 86_400;
const VOUCHER = 1_000_000n;

function ask(
  overrides: Partial<Omit<VoucherAsk, "setup">> & {
    setup?: Partial<VoucherAsk["setup"]> | null;
  } = {}
): VoucherAsk {
  const { setup, ...rest } = overrides;
  return {
    commitmentId: 41n,
    buyer: "0x52a0000000000000000000000000000000009a1a",
    claimHash: `0x${"c1".repeat(32)}`,
    agreed: { revision: 2n, termsHash: `0x${"7e".repeat(32)}` },
    current: { revision: 2n, termsHash: `0x${"7e".repeat(32)}` },
    agreedAt: NOW - 2 * DAY,
    issuer: {
      name: "Tech and Sun",
      chainId: 100,
      safe: "0x5afe000000000000000000000000000000005afe",
      decimals: 6,
    },
    ...rest,
    setup:
      setup === null
        ? null
        : {
            voucherUnits: VOUCHER,
            approvedAt: NOW - DAY,
            depositedUnits: VOUCHER,
            depositConfirmed: true,
            acceptBy: NOW + 5 * DAY,
            ...setup,
          },
  };
}

describe("voucher acceptance checks", () => {
  it("lets the steward accept only when consent, approval, deposit and deadline all hold", () => {
    const cases: Array<
      [string, VoucherAsk, keyof ReturnType<typeof selectVoucherAcceptanceChecks>]
    > = [
      [
        "the offer's terms changed after the member agreed",
        ask({ current: { revision: 3n, termsHash: `0x${"7e".repeat(32)}` } }),
        "consent",
      ],
      [
        "the terms hash moved under the same revision",
        ask({ current: { revision: 2n, termsHash: `0x${"8f".repeat(32)}` } }),
        "consent",
      ],
      [
        "the consent can't be named, so the contract would refuse it",
        ask({ claimHash: `0x${"00".repeat(32)}` }),
        "consent",
      ],
      ["the issuer's Safe hasn't approved", ask({ setup: { approvedAt: null } }), "approval"],
      [
        "the deposit is short of the booking",
        ask({ setup: { depositedUnits: VOUCHER - 1n } }),
        "deposit",
      ],
      [
        "the deposit hasn't reached Green Goods",
        ask({ setup: { depositConfirmed: false } }),
        "deposit",
      ],
      ["the deadline passed", ask({ setup: { acceptBy: NOW - 1 } }), "deadline"],
    ];
    for (const [why, booking, failing] of cases) {
      const checks = selectVoucherAcceptanceChecks(booking, NOW);
      expect(checks[failing], why).toBe(false);
      expect(checks.ready, why).toBe(false);
    }

    expect(selectVoucherAcceptanceChecks(ask(), NOW)).toEqual({
      consent: true,
      approval: true,
      deposit: true,
      deadline: true,
      ready: true,
    });
    // The contract refuses only after the deadline, so its last second still counts.
    expect(selectVoucherAcceptanceChecks(ask({ setup: { acceptBy: NOW } }), NOW).ready).toBe(true);
  });

  it("fails every setup check while the escrow setup hasn't reached the issuer", () => {
    expect(selectVoucherAcceptanceChecks(ask({ setup: null }), NOW)).toEqual({
      consent: true,
      approval: false,
      deposit: false,
      deadline: false,
      ready: false,
    });
  });
});

describe("voucher ask stage", () => {
  it("reads where the booking stands in the order it moves, the blocking states first", () => {
    const cases: Array<[VoucherAsk, ReturnType<typeof selectVoucherAskStage>]> = [
      [ask({ current: { revision: 3n, termsHash: `0x${"7e".repeat(32)}` } }), "terms-changed"],
      [
        ask({
          claimHash: `0x${"00".repeat(32)}`,
          current: { revision: 3n, termsHash: `0x${"7e".repeat(32)}` },
        }),
        "terms-changed",
      ],
      // Deposited and approved, but with no consent to name the acceptance refuses (Codex on #1320).
      [ask({ claimHash: `0x${"00".repeat(32)}` }), "consent-missing"],
      [ask({ claimHash: "0x1234" as VoucherAsk["claimHash"], setup: null }), "consent-missing"],
      [ask({ setup: null }), "setting-up"],
      [ask({ setup: { acceptBy: NOW - 1, approvedAt: null } }), "past-deadline"],
      [
        ask({ setup: { approvedAt: null, depositedUnits: 0n, depositConfirmed: false } }),
        "needs-approval",
      ],
      [ask({ setup: { depositedUnits: 0n, depositConfirmed: false } }), "waiting-for-deposit"],
      [ask({ setup: { depositConfirmed: false } }), "waiting-for-deposit"],
      [ask(), "ready"],
    ];
    for (const [booking, stage] of cases) {
      expect(selectVoucherAskStage(booking, NOW)).toBe(stage);
    }
  });
});

describe("return proposal", () => {
  const booking = { voucherUnits: 10n * VOUCHER, returnLimit: 6n * VOUCHER, returnCeiling: 0n };

  it("splits the deposit into what goes back and what the issuer keeps, within the terms", () => {
    expect(selectReturnProposal(booking, 6n * VOUCHER)).toEqual({
      refund: 6n * VOUCHER,
      release: 4n * VOUCHER,
      aboveTerms: false,
      belowCeiling: false,
      valid: true,
    });
  });

  it("refuses a return above the terms' limit, and one that returns nothing", () => {
    expect(selectReturnProposal(booking, 7n * VOUCHER)).toMatchObject({
      aboveTerms: true,
      valid: false,
    });
    expect(selectReturnProposal(booking, 0n)).toMatchObject({ aboveTerms: false, valid: false });
  });

  // `authorizeReturn` reverts below the ceiling it keeps, and the issuer's own review asks for a
  // strict increase, so a smaller proposal is a Safe write bound to fail (Codex on #1320).
  it("refuses a return that doesn't raise the ceiling the escrow keeps", () => {
    const proposed = { ...booking, returnCeiling: 4n * VOUCHER };
    for (const refund of [3n * VOUCHER, 4n * VOUCHER]) {
      expect(selectReturnProposal(proposed, refund), String(refund)).toMatchObject({
        belowCeiling: true,
        valid: false,
      });
    }
    expect(selectReturnProposal(proposed, 5n * VOUCHER)).toMatchObject({
      belowCeiling: false,
      valid: true,
    });
  });
});

describe("allowance raise", () => {
  it("raises only above what the garden's rewards can still draw", () => {
    const usedUp = { allowance: { left: 0n } };
    expect(selectAllowanceRaise(usedUp, 6n * VOUCHER)).toEqual({ valid: true });
    expect(selectAllowanceRaise(usedUp, 0n)).toEqual({ valid: false });
    expect(selectAllowanceRaise({ allowance: { left: 2n * VOUCHER } }, 2n * VOUCHER)).toEqual({
      valid: false,
    });
  });
});

describe("who approves a booking", () => {
  const STEWARD = "0x6166e1964447e0959bc7c8d543db3ab82db65044" as Address;
  const OTHER = "0x1111111111111111111111111111111111111111" as Address;
  const issuer = ask().issuer;
  const safe = (signers: readonly Address[] | null): IssuerSafeThreshold => ({
    safe: issuer.safe,
    status: signers ? "observed" : "unavailable",
    threshold: signers ? 1 : null,
    owners: signers?.length ?? null,
    signers,
  });

  // Approving is the issuer Safe's act: a steward who can't sign it sees the booking wait
  // (Codex on #1320).
  it("offers Approve only to an owner of the booking issuer's own Safe", () => {
    const cases: Array<[string, Parameters<typeof selectCanApproveBooking>[0], boolean]> = [
      [
        "an owner of the Safe",
        { ask: ask(), issuer, safe: safe([OTHER, STEWARD]), viewer: STEWARD },
        true,
      ],
      [
        "a steward who isn't an owner",
        { ask: ask(), issuer, safe: safe([OTHER]), viewer: STEWARD },
        false,
      ],
      [
        "a Safe whose owners can't be read",
        { ask: ask(), issuer, safe: safe(null), viewer: STEWARD },
        false,
      ],
      ["no Safe read yet", { ask: ask(), issuer, safe: undefined, viewer: STEWARD }, false],
      ["no viewer", { ask: ask(), issuer, safe: safe([STEWARD]), viewer: undefined }, false],
      [
        "a booking another issuer approves",
        {
          ask: ask({ issuer: { ...issuer, safe: OTHER } }),
          issuer,
          safe: safe([STEWARD]),
          viewer: STEWARD,
        },
        false,
      ],
      [
        "the same Safe address on another network",
        {
          ask: ask({ issuer: { ...issuer, chainId: 1 } }),
          issuer,
          safe: safe([STEWARD]),
          viewer: STEWARD,
        },
        false,
      ],
      [
        "a garden that issues no vouchers",
        { ask: ask(), issuer: null, safe: safe([STEWARD]), viewer: STEWARD },
        false,
      ],
    ];
    for (const [why, input, approves] of cases) {
      expect(selectCanApproveBooking(input), why).toBe(approves);
    }
    // Owners come back lowercased from the read; a viewer's checksummed address still matches.
    expect(
      selectCanApproveBooking({
        ask: ask(),
        issuer,
        safe: safe([STEWARD]),
        viewer: "0x6166E1964447E0959BC7C8D543DB3AB82DB65044" as Address,
      })
    ).toBe(true);
  });
});

describe("voucher amount entry", () => {
  it("reads a plain decimal into token units, and nothing else", () => {
    expect(parseVoucherAmount("6", 6)).toBe(6n * VOUCHER);
    expect(parseVoucherAmount(" 0.5 ", 6)).toBe(VOUCHER / 2n);
    for (const entry of ["", "abc", "-1", "1e3", "1.", ".5", "1.0000001", "6 vouchers"]) {
      expect(parseVoucherAmount(entry, 6), entry).toBeNull();
    }
  });
});
