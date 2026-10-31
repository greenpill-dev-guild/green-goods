import type { ServiceIssuerDraft } from "@green-goods/shared/commitment-pooling";
import type { ReactNode } from "react";
import type { IntlShape } from "react-intl";
import { issuerCount, issuerPlural } from "./serviceIssuerPresentation";

export interface DraftFact {
  id: string;
  label: string;
  value: string;
  detail?: string;
  changed?: boolean;
}

/** The pool's price index has six decimals: the pilot's 1:1 vouchers sit at exactly 1. */
const PRICE_DECIMALS = 6;

/** Every setting the member signs, as fact rows; the service's own words stay as written. */
export function draftFacts(draft: ServiceIssuerDraft, intl: IntlShape): DraftFact[] {
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `app.voucher.ob.${id}` }, values);
  const { terms } = draft;
  const decimals = terms.token.decimals;
  const count = (value: bigint) => issuerCount(value, decimals, intl.locale);
  const units = (value: bigint) => `${count(value)} ${terms.token.symbol}`;
  const changed = (...settings: string[]) =>
    settings.some((setting) => draft.changed.includes(setting as never));
  return [
    {
      id: "unit",
      label: t("f.unit"),
      value: terms.service.buys,
      detail: terms.service.scope,
      changed: changed("service"),
    },
    {
      id: "capacity",
      label: t("f.cap"),
      value: t("f.capV", { count: count(terms.capacity.units), weeks: terms.capacity.weeks }),
      detail: t("f.capS"),
      changed: changed("capacity"),
    },
    {
      id: "issue",
      label: t("f.issue"),
      value: units(terms.issue.total),
      detail: t("f.issueS", {
        pool: issuerPlural(terms.issue.pool, decimals),
        reserve: issuerPlural(terms.issue.total - terms.issue.pool, decimals),
      }),
      changed: changed("issue"),
    },
    {
      id: "allowance",
      label: t("f.allow"),
      value: t("f.allowV", { count: count(terms.rewardAllowance) }),
      detail: t("f.allowS"),
      changed: changed("rewardAllowance"),
    },
    {
      id: "rate",
      label: t("f.rate"),
      value: t("f.rateV", {
        symbol: terms.token.symbol,
        index: issuerCount(terms.priceIndex, PRICE_DECIMALS, intl.locale),
      }),
      detail: t("f.rateS"),
      changed: changed("priceIndex"),
    },
    {
      id: "fees",
      label: t("f.fees"),
      // The pool's fee policy counts in parts per million.
      value:
        terms.poolFee === 0n
          ? t("f.feesNone")
          : t("f.feesV", {
              percent: intl.formatNumber(Number(terms.poolFee) / 1_000_000, {
                style: "percent",
                maximumFractionDigits: 4,
              }),
            }),
      detail: t("f.feesS"),
      changed: changed("poolFee"),
    },
    {
      id: "pool",
      label: t("f.pool"),
      value: units(terms.poolHoldingCap),
      detail: t("f.poolS"),
      changed: changed("poolHoldingCap"),
    },
    {
      id: "reply",
      label: t("f.reply"),
      value: t("f.replyV", { days: terms.replyBusinessDays }),
      detail: t("f.replyS"),
      changed: changed("replyBusinessDays"),
    },
    {
      id: "deadline",
      label: t("f.deadline"),
      value: t("f.deadlineV", { days: terms.acceptanceDays }),
      detail: t("f.deadlineS"),
      changed: changed("acceptanceDays"),
    },
    {
      id: "short",
      label: t("f.short"),
      value: terms.service.remedy,
      detail: t("f.shortS"),
      changed: changed("service"),
    },
  ];
}

export const factValue = (fact: Pick<DraftFact, "value" | "detail">): ReactNode => (
  <>
    {fact.value}
    {fact.detail ? (
      <span className="mt-0.5 block text-xs font-normal leading-4 text-text-sub-600">
        {fact.detail}
      </span>
    ) : null}
  </>
);
