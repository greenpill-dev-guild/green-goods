/** @vitest-environment happy-dom */

/**
 * A member's booking in the Promises console (PRD-1299 slice 2, `SIssuer` · Accept member
 * booking): Teo approves Maya's lesson from his own account, then the pool's steward accepts
 * it. The ask's line and the acceptance's checks name Teo as the one who approved, never the
 * steward's Safe, and the acceptance says the steward couldn't have approved for him.
 */

import enMessages from "@green-goods/shared/i18n/en.json";
import {
  selectVoucherAskStage,
  type VoucherAsk,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { Address } from "@green-goods/shared/types/domain";
import { createIntl } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { VoucherAcceptDialog } from "@/views/Garden/Pool/VoucherAskDialogs";
import { voucherAskDetail } from "@/views/Garden/Pool/voucherPresentation";
import { renderWithProviders, screen, within } from "../test-utils";

const MAYA = "0x9e60000000000000000000000000000000007e5f" as Address;

vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: (address?: string | null) => ({
    data: address?.toLowerCase() === "0x9e60000000000000000000000000000000007e5f" ? "Maya" : null,
  }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: [] }),
}));

const NOW = 1_771_800_000;
const DAY = 86_400;
const intl = createIntl({ locale: "en", messages: enMessages });

const TEO = {
  kind: "individual",
  name: "Teo Alves",
  chainId: 100,
  account: "0x000000000000000000000000000000000000e7e0",
  decimals: 6,
} as const;
const TECH_AND_SUN = {
  kind: "collective",
  name: "Tech and Sun",
  chainId: 100,
  safe: "0x5afe00000000000000000000000000000000a1b2",
  decimals: 6,
} as const;

/** Maya's booking, approved a day ago and deposited, unless the setup says otherwise. */
function ask(
  issuer: VoucherAsk["issuer"],
  setup: Partial<NonNullable<VoucherAsk["setup"]>> = {}
): VoucherAsk {
  const terms = { revision: 2n, termsHash: `0x${"7e".repeat(32)}` } as const;
  return {
    commitmentId: 44n,
    buyer: MAYA,
    claimHash: `0x${"c4".repeat(32)}`,
    agreed: terms,
    current: terms,
    agreedAt: NOW - DAY,
    issuer,
    setup: {
      voucherUnits: 1_000_000n,
      approvedAt: NOW - DAY + 7_200,
      depositedUnits: 1_000_000n,
      depositConfirmed: true,
      acceptBy: NOW + 6 * DAY,
      ...setup,
    },
  };
}

function acceptDialog(booking: VoucherAsk) {
  renderWithProviders(
    <VoucherAcceptDialog
      ask={booking}
      title="Integration lesson, 60 minutes"
      target={{ gardenName: "Tech and Sun", isProtocol: false }}
      chainId={42161}
      now={NOW}
      phase={{ status: "idle" }}
      disabled={false}
      onClose={vi.fn()}
      onAccept={vi.fn()}
    />
  );
  return within(screen.getByRole("dialog"));
}

const detail = (booking: VoucherAsk) =>
  voucherAskDetail(booking, selectVoucherAskStage(booking, NOW), intl, NOW * 1000);

describe("a member's booking in the Promises console", () => {
  it("names the member as the one who approved, and says the steward couldn't", () => {
    const dialog = acceptDialog(ask(TEO));
    expect(dialog.getByText("Maya agreed to Teo Alves’s current terms")).toBeInTheDocument();
    expect(
      dialog.getByText("Teo Alves approved the booking from their account")
    ).toBeInTheDocument();
    expect(dialog.getByText("1 Teo Alves voucher deposited in escrow")).toBeInTheDocument();
    expect(
      dialog.getByText(
        "You accept as the pool’s steward. Teo Alves’s approval was required first; you couldn’t give it for them."
      )
    ).toBeInTheDocument();
    expect(dialog.queryByText("Your Safe approved the booking")).not.toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Accept Maya" })).toBeEnabled();
  });

  it("keeps a collective's booking on its Safe's approval", () => {
    const dialog = acceptDialog(ask(TECH_AND_SUN));
    expect(dialog.getByText("Your Safe approved the booking")).toBeInTheDocument();
    expect(dialog.getByText("1 voucher deposited in escrow")).toBeInTheDocument();
    expect(
      dialog.getByText(
        "Starting follows on the voucher network. It doesn’t mean the visit happened."
      )
    ).toBeInTheDocument();
  });

  it("says on the ask's line that the member approved, once the deposit is confirmed", () => {
    expect(detail(ask(TEO))).toMatch(
      /^1 Teo Alves voucher in escrow · Teo Alves approved · accept by \S/
    );
    expect(detail(ask(TECH_AND_SUN))).toMatch(/^1 voucher in escrow · accept by \S/);
  });

  it("says who approved while the booking waits for the deposit", () => {
    const waiting = { depositedUnits: 0n, depositConfirmed: false };
    expect(detail(ask(TEO, waiting))).toMatch(/^Teo Alves approved \S.* · accept by \S/);
    expect(detail(ask(TECH_AND_SUN, waiting))).toMatch(/^Approved \S.* · accept by \S/);
  });
});
