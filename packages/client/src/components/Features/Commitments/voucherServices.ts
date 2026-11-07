import type { VoucherIssuer } from "@green-goods/shared/commitment-pooling";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import type { IntlShape } from "react-intl";

/** Keep issuer-authored names, translating the reviewed catalog names and standard units. */
export function voucherServiceDescriptions(
  issuer: Pick<VoucherIssuer, "services"> | null,
  decimals: number | null,
  intl: Pick<IntlShape, "formatMessage" | "locale">
): string[] {
  if (!issuer?.services?.length || decimals === null)
    return [intl.formatMessage({ id: "app.voucher.service.unavailable" })];
  const names: Record<string, string> = {
    "Assisted session": "assisted",
    "Claude Team Standard access": "claude",
    "Hub visit": "hub",
    "Integration lesson": "lesson",
  };
  const units: Record<string, "minute" | "hour" | "day"> = {
    minute: "minute",
    minutes: "minute",
    hour: "hour",
    hours: "hour",
    "seat days": "day",
    day: "day",
    days: "day",
  };
  return issuer.services.map((service) => {
    const unit = units[service.unit.trim().toLowerCase()];
    const quantity = unit
      ? new Intl.NumberFormat(intl.locale, { style: "unit", unit, unitDisplay: "long" }).format(
          service.serviceUnits
        )
      : `${new Intl.NumberFormat(intl.locale).format(service.serviceUnits)} ${service.unit}`;
    return intl.formatMessage(
      { id: "app.voucher.service.booking" },
      {
        service: intl.formatMessage(
          { id: "app.voucher.service.name" },
          { kind: names[service.name] ?? "other", name: service.name }
        ),
        units: quantity,
        vouchers: formatTokenAmount(service.voucherUnits, decimals, decimals, intl.locale, true),
        pluralCount: service.voucherUnits === 10n ** BigInt(decimals) ? 1 : 2,
      }
    );
  });
}
