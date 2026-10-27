import { Alert } from "@green-goods/shared/components/Alert";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import type { SheetActionsProps } from "@green-goods/shared/components/Dialog/SheetActions";
import { SheetHeading } from "@green-goods/shared/components/Dialog/SheetHeading";
import type { ServiceAsset, VoucherIssuer } from "@green-goods/shared/commitment-pooling";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { detailed } from "./ServiceRedeemSheet";

/** One direct exchange in the shared pool, quoted with its fees, minimum, deadline and recipient. */
export interface ServiceExchangeQuote {
  input: { amount: bigint; asset: ServiceAsset; issuer: Pick<VoucherIssuer, "name" | "gender"> };
  output: { amount: bigint; asset: ServiceAsset; issuer: Pick<VoucherIssuer, "name" | "gender"> };
  /** The output before fees, so the rate is the one the quote prices at. */
  gross: bigint;
  /** The pool's own fee and the protocol's, both taken from the output. */
  poolFee: bigint;
  protocolFee: bigint;
  minimum: bigint;
  /** Unix seconds after which the quote no longer runs. */
  deadline: number;
  /** What the reader holds of the input voucher. */
  held: bigint;
  /** What the pool can still give right now, for the short-pool answer. */
  available: bigint;
  /** When the exchange settled, for its receipt. */
  settledAt?: number | null;
}

export type ServiceExchangeState =
  | "quote"
  | "review"
  | "waiting"
  | "done"
  | "expired"
  | "short"
  | "limit"
  | "listed"
  | "failed";

export interface ServiceExchangeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: ServiceExchangeQuote;
  state: ServiceExchangeState;
  isPending: boolean;
  onReview: () => void;
  onExchange: () => void;
  onCheck: () => void;
  onRequote: () => void;
  /** A short pool's smaller exchange, quoted for what it can give; null when nothing fits. */
  onSmaller: (() => void) | null;
  onBack: () => void;
}

/**
 * Exchange Vouchers in the shared pool. The quote shows the fees, the minimum, its deadline and
 * where the vouchers go; its review is the sheet's second step. An unknown result blocks another
 * paid exchange until it resolves, a failed one spends nothing, and a swap books nothing.
 */
export function ServiceExchangeSheet({
  open,
  onOpenChange,
  quote,
  state,
  isPending,
  onReview,
  onExchange,
  onCheck,
  onRequote,
  onSmaller,
  onBack,
}: ServiceExchangeSheetProps) {
  const { formatMessage, formatTime, formatDate, locale } = useIntl();
  const unitOf = (side: ServiceExchangeQuote["input"], amount: bigint) =>
    formatMessage(
      { id: "app.voucher.unit" },
      {
        issuer: side.issuer.name,
        gender: side.issuer.gender ?? "other",
        count: amount === 10n ** BigInt(side.asset.decimals ?? 0) ? 1 : 2,
      }
    );
  const amount = (side: ServiceExchangeQuote["input"], value: bigint) =>
    formatTokenAmount(value, side.asset.decimals ?? 0, side.asset.decimals ?? 0, locale);
  const inUnit = unitOf(quote.input, quote.input.amount);
  const outUnit = unitOf(quote.output, quote.output.amount);
  const fee = quote.poolFee + quote.protocolFee;
  const time = formatTime(quote.deadline * 1000, { hour: "numeric", minute: "2-digit" });
  const values = {
    in: amount(quote.input, quote.input.amount),
    out: amount(quote.output, quote.output.amount),
    pool: amount(quote.output, quote.poolFee),
    proto: amount(quote.output, quote.protocolFee),
    fee: amount(quote.output, fee),
    min: amount(quote.output, quote.minimum),
    avail: amount(quote.output, quote.available),
    time,
    inUnit,
    outUnit,
  };
  const t = (id: string) => formatMessage({ id: `app.voucher.${id}` }, values);
  const whole = (side: ServiceExchangeQuote["input"]) => 10n ** BigInt(side.asset.decimals ?? 0);
  const one = (side: ServiceExchangeQuote["input"]) =>
    `${amount(side, whole(side))} ${unitOf(side, whole(side))}`;
  // One input voucher's worth at the quote's own rate, before fees.
  const perOne =
    quote.input.amount > 0n ? (quote.gross * whole(quote.input)) / quote.input.amount : 0n;
  const notice = (variant: "info" | "warning" | "success", key: string) => (
    <Alert variant={variant} title={t(`ex.n.${key}.t`)} className="p-3">
      {t(`ex.n.${key}.b`)}
    </Alert>
  );
  const quoteFacts: ReactNode = (
    <FactList frame="inset">
      <FactRow
        label={t("ex.f.rate")}
        value={detailed(
          formatMessage(
            { id: "app.voucher.ex.f.rateVH" },
            {
              in: one(quote.input),
              out: `${amount(quote.output, perOne)} ${unitOf(quote.output, perOne)}`,
            }
          ),
          t("ex.f.rateSH")
        )}
      />
      <FactRow label={t("ex.f.fees")} value={detailed(t("ex.f.feesV"), t("ex.f.feesS"))} />
      <FactRow label={t("ex.f.min")} value={detailed(t("ex.f.minV"), t("ex.f.minS"))} />
      <FactRow label={t("ex.f.until")} value={detailed(time, t("ex.f.untilS"))} />
      <FactRow label={t("ex.f.to")} value={t("ex.f.toV")} />
      <FactRow label={t("ex.f.pool")} value={detailed(t("ex.f.poolV"), t("ex.f.poolS"))} />
    </FactList>
  );
  const amounts = (
    <FactList frame="inset" data-component="ServiceExchangeAmounts">
      <FactRow
        label={t("ex.spend")}
        value={detailed(
          `${values.in} ${inUnit}`,
          formatMessage({ id: "app.voucher.ex.hold" }, { n: amount(quote.input, quote.held) })
        )}
      />
      <FactRow
        label={t("ex.receive")}
        value={detailed(`${values.out} ${outUnit}`, t("ex.afterFees"))}
      />
    </FactList>
  );
  const details = (
    <details className="text-xs text-text-sub-600">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium">
        {t("c.tech")}
      </summary>
      <ul className="space-y-1.5 pb-1">
        <li>{t("ex.x.pool")}</li>
        <li>{t("ex.x.min")}</li>
      </ul>
    </details>
  );

  let title = t("ex.title");
  let body: ReactNode;
  let actions: SheetActionsProps;
  if (state === "review") {
    title = t("ex.sh.title");
    body = (
      <>
        <FactList frame="inset">
          <FactRow label={t("ex.spend")} value={`${values.in} ${inUnit}`} />
          <FactRow
            label={t("ex.receive")}
            value={detailed(`${values.out} ${outUnit}`, t("ex.sh.atLeast"))}
          />
          <FactRow label={t("ex.f.fees")} value={detailed(t("ex.f.feesV"), t("ex.f.feesS"))} />
          <FactRow label={t("ex.f.until")} value={time} />
          <FactRow label={t("ex.f.to")} value={t("ex.f.toV")} />
        </FactList>
        <p className="text-sm text-text-sub-600">{t("ex.sh.note")}</p>
        <p className="text-xs text-text-sub-600">{t("c.passkey")}</p>
      </>
    );
    actions = { primary: { label: t("ex.sh.cta"), loading: isPending, onClick: onExchange } };
  } else if (state === "done") {
    body = (
      <>
        {notice("success", "done")}
        <SheetHeading>{t("ex.rc.title")}</SheetHeading>
        <FactList frame="inset" data-component="ServiceExchangeReceipt">
          <FactRow label={t("ex.rc.spent")} value={`${values.in} ${inUnit}`} />
          <FactRow label={t("ex.rc.got")} value={`${values.out} ${outUnit}`} />
          <FactRow label={t("ex.rc.fees")} value={`${values.fee} ${outUnit}`} />
          {quote.settledAt ? (
            <FactRow
              label={t("ex.rc.when")}
              value={`${formatDate(quote.settledAt * 1000, { month: "short", day: "numeric" })} · ${formatTime(quote.settledAt * 1000, { hour: "numeric", minute: "2-digit" })}`}
            />
          ) : null}
        </FactList>
        <SheetHeading>{t("ex.quoteUsed")}</SheetHeading>
        {quoteFacts}
        {details}
      </>
    );
    actions = { primary: { label: t("ex.a.back2"), onClick: onBack } };
  } else {
    const answer =
      state === "waiting"
        ? notice("warning", "wait")
        : state === "expired"
          ? notice("warning", "expired")
          : state === "short"
            ? notice("warning", "short")
            : state === "limit"
              ? notice("warning", "limit")
              : state === "listed"
                ? notice("warning", "listed")
                : state === "failed"
                  ? notice("warning", "failed")
                  : null;
    body = (
      <>
        <p className="text-sm text-text-sub-600">{t("ex.desc")}</p>
        {answer}
        {amounts}
        <SheetHeading>{t("ex.quote")}</SheetHeading>
        {quoteFacts}
        {details}
      </>
    );
    actions =
      state === "waiting"
        ? { primary: { label: t("ex.a.check"), loading: isPending, onClick: onCheck } }
        : state === "expired" || state === "failed"
          ? { primary: { label: t("ex.a.requote"), loading: isPending, onClick: onRequote } }
          : state === "short"
            ? onSmaller
              ? { primary: { label: t("ex.a.smaller"), loading: isPending, onClick: onSmaller } }
              : { secondary: { label: t("ex.a.back2"), onClick: onBack } }
            : state === "limit" || state === "listed"
              ? { secondary: { label: t("ex.a.back2"), onClick: onBack } }
              : { primary: { label: t("ex.a.review"), onClick: onReview } };
  }
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      preventClose={isPending}
      title={title}
      description={state === "review" ? t("ex.title") : t("ex.kind")}
      size="md"
      sheetSize="full"
      actions={actions}
    >
      <div className="space-y-4" data-component="ServiceExchangeSheet" data-state={state}>
        {body}
      </div>
    </DialogShell>
  );
}
