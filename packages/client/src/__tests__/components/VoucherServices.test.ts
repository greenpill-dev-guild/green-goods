import { describe, expect, it } from "vitest";
import { createIntl } from "react-intl";
import en from "@green-goods/shared/i18n/en";
import { voucherServiceDescriptions } from "../../components/Features/Commitments/voucherServices";

const intl = createIntl({ locale: "en", messages: en });
const terms = {
  name: "Assisted session",
  unit: "minutes",
  serviceUnits: 45n,
  voucherUnits: 2_000_000n,
  serviceTermsRef: `0x${"a".repeat(64)}` as const,
};

describe("voucher service descriptions", () => {
  it("keeps the real booking price rather than inventing a fractional session", () => {
    expect(voucherServiceDescriptions({ services: [terms] }, 6, intl)).toEqual([
      "Assisted session: 45 minutes for 2 vouchers",
    ]);
  });
  it("lists every reviewed service without treating one as the token's only use", () => {
    expect(
      voucherServiceDescriptions(
        {
          services: [
            terms,
            {
              ...terms,
              name: "Claude Team Standard access",
              unit: "seat days",
              serviceUnits: 30n,
              voucherUnits: 10_000_000n,
            },
          ],
        },
        6,
        intl
      )
    ).toEqual([
      "Assisted session: 45 minutes for 2 vouchers",
      "Claude Team Standard access: 30 days for 10 vouchers",
    ]);
  });
  it("preserves an issuer's own service name and unit, including large quantities", () => {
    const result = voucherServiceDescriptions(
      {
        services: [
          {
            ...terms,
            name: "Bike repair",
            unit: "repairs",
            serviceUnits: 9_007_199_254_740_993n,
            voucherUnits: 500_000n,
          },
        ],
      },
      6,
      intl
    );
    expect(result).toEqual(["Bike repair: 9,007,199,254,740,993 repairs for 0.5 vouchers"]);
  });
  it.each([
    null,
    {},
    { services: null },
    { services: [] },
  ])("does not invent service terms when they are missing: %j", (issuer) => {
    expect(voucherServiceDescriptions(issuer, 6, intl)).toEqual(["Service terms unavailable"]);
  });
  it("does not guess voucher quantities when the asset's decimals are unknown", () => {
    expect(voucherServiceDescriptions({ services: [terms] }, null, intl)).toEqual([
      "Service terms unavailable",
    ]);
  });
});
