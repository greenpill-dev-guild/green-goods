import type { ServiceAccessSnapshot } from "@green-goods/shared/commitment-pooling";
import { useIntl } from "react-intl";
import { type ServiceExchangeQuote, ServiceExchangeSheet } from "./ServiceExchangeSheet";
import { exchangeStateFromPilot } from "./serviceExchange";
import { type ServiceRedeemOutcome, ServiceRedeemSheet } from "./ServiceRedeemSheet";
import { ServiceSplitSheet } from "./ServiceSplitSheet";
import type { ServiceBookingView } from "./serviceBookingTypes";

export type ServiceSheet = "redeem" | "split" | "exchange" | null;

export interface ServiceBookingSheetsProps {
  booking: ServiceBookingView;
  snapshot: ServiceAccessSnapshot;
  /** The promise's title, under the split sheet's own. */
  heading: string;
  sheet: ServiceSheet;
  onClose: () => void;
  redeem: {
    reviewed: { revision: bigint; units: bigint } | null;
    outcome: ServiceRedeemOutcome;
    held: bigint | null;
    onAgree: () => void;
    onDeposit: () => void;
    onCheck: () => void;
  };
  onApproveSplit: () => void;
  onReport: (() => void) | null;
  exchange: {
    quote: ServiceExchangeQuote | null;
    reviewing: boolean;
    onOpen: () => void;
    onReview: () => void;
    onExchange: () => void;
    onCheck: () => void;
    onRequote: () => void;
  };
  isPending: boolean;
}

/** The sheets over a voucher booking's promise page; each act's writes run in the page. */
export function ServiceBookingSheets({
  booking,
  snapshot,
  heading,
  sheet,
  onClose,
  redeem,
  onApproveSplit,
  onReport,
  exchange,
  isPending,
}: ServiceBookingSheetsProps) {
  const intl = useIntl();
  const close = (open: boolean) => {
    if (!open) onClose();
  };
  const agreeDeadline =
    snapshot.sourceTimestamp !== null
      ? intl.formatDate(Number(snapshot.sourceTimestamp + 7n * 86_400n) * 1000, {
          month: "short",
          day: "numeric",
        })
      : null;
  return (
    <>
      <ServiceRedeemSheet
        open={sheet === "redeem"}
        onOpenChange={close}
        view={booking}
        reviewed={redeem.reviewed}
        agreeDeadline={agreeDeadline}
        outcome={redeem.outcome}
        held={redeem.held}
        isPending={isPending}
        onAgree={redeem.onAgree}
        onDeposit={redeem.onDeposit}
        onCheck={redeem.onCheck}
        onExchange={exchange.onOpen}
      />
      <ServiceSplitSheet
        open={sheet === "split"}
        onOpenChange={close}
        view={booking}
        title={heading}
        isPending={isPending}
        onApprove={onApproveSplit}
        onReport={onReport}
      />
      {exchange.quote ? (
        <ServiceExchangeSheet
          open={sheet === "exchange"}
          onOpenChange={close}
          quote={exchange.quote}
          state={exchangeStateFromPilot(snapshot, exchange.reviewing)}
          isPending={isPending}
          onReview={exchange.onReview}
          onExchange={exchange.onExchange}
          onCheck={exchange.onCheck}
          onRequote={exchange.onRequote}
          onBack={onClose}
        />
      ) : null}
    </>
  );
}
