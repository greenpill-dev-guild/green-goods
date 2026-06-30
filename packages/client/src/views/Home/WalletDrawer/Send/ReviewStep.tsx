import {
  Alert,
  formatAddress,
  formatTokenAmount,
  type SendableTokenBalance,
} from "@green-goods/shared";
import { useIntl } from "react-intl";
import type { SelectedRecipient } from "./types";

interface ReviewStepProps {
  recipient: SelectedRecipient;
  token: SendableTokenBalance;
  parsedAmount: bigint;
  note: string;
  onNoteChange: (value: string) => void;
  isOnline: boolean;
}

function SummaryRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-xs uppercase tracking-wide text-text-soft-400">{label}</span>
      <span className="truncate text-sm font-medium text-text-strong-950" title={title ?? value}>
        {value}
      </span>
    </div>
  );
}

export function ReviewStep({
  recipient,
  token,
  parsedAmount,
  note,
  onNoteChange,
  isOnline,
}: ReviewStepProps) {
  const { formatMessage } = useIntl();
  const recipientLabel = recipient.ensName || formatAddress(recipient.address);

  return (
    <div className="space-y-4 p-4">
      <div className="divide-y divide-stroke-soft-200 rounded-lg border border-stroke-soft-200 bg-bg-white-0 px-3">
        <SummaryRow
          label={formatMessage({ id: "app.send.review.to" })}
          value={recipientLabel}
          title={recipient.address}
        />
        <SummaryRow label={formatMessage({ id: "app.send.review.token" })} value={token.symbol} />
        <SummaryRow
          label={formatMessage({ id: "app.send.review.amount" })}
          value={`${formatTokenAmount(parsedAmount, token.decimals)} ${token.symbol}`}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="send-note"
          className="text-xs font-medium uppercase tracking-wide text-text-soft-400"
        >
          {formatMessage({ id: "app.send.note.label" })}
        </label>
        <textarea
          id="send-note"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={formatMessage({ id: "app.send.note.placeholder" })}
          rows={2}
          className="w-full resize-none rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 placeholder:text-text-soft-400 focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20"
        />
      </div>

      {token.confersGovernance ? (
        <Alert
          variant="information"
          title={formatMessage({ id: "app.send.governance.reviewTitle" })}
        >
          {formatMessage({ id: "app.send.governance.reviewBody" })}
        </Alert>
      ) : null}

      {!isOnline ? (
        <Alert variant="warning">{formatMessage({ id: "app.send.review.offline" })}</Alert>
      ) : null}
    </div>
  );
}
