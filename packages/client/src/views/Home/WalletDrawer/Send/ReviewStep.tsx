import { Alert, formatTokenAmount, type SendableTokenBalance } from "@green-goods/shared";
import { RiPencilLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import type { SelectedRecipient } from "./types";

interface ReviewStepProps {
  recipient: SelectedRecipient;
  /** Resolved recipient display name (ENS → address), computed by the parent. */
  recipientLabel: string;
  token: SendableTokenBalance;
  parsedAmount: bigint;
  note: string;
  onNoteChange: (value: string) => void;
  onEditRecipient: () => void;
  onEditAmount: () => void;
}

function SummaryRow({
  label,
  value,
  title,
  onEdit,
  editLabel,
}: {
  label: string;
  value: string;
  title?: string;
  onEdit?: () => void;
  editLabel?: string;
}) {
  const body = (
    <>
      <span className="shrink-0 text-xs uppercase tracking-wide text-text-soft-400">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-medium text-text-strong-950" title={title ?? value}>
          {value}
        </span>
        {onEdit ? (
          <RiPencilLine className="h-3.5 w-3.5 shrink-0 text-text-soft-400" aria-hidden />
        ) : null}
      </span>
    </>
  );

  if (onEdit) {
    return (
      <button
        type="button"
        onClick={onEdit}
        aria-label={editLabel}
        className="flex w-full items-center justify-between gap-3 py-2 text-left transition hover:opacity-80"
      >
        {body}
      </button>
    );
  }
  return <div className="flex items-center justify-between gap-3 py-2">{body}</div>;
}

export function ReviewStep({
  recipient,
  recipientLabel,
  token,
  parsedAmount,
  note,
  onNoteChange,
  onEditRecipient,
  onEditAmount,
}: ReviewStepProps) {
  const { formatMessage } = useIntl();
  const editLabel = formatMessage({ id: "app.send.edit" });

  return (
    <div className="space-y-4 p-4">
      <div className="divide-y divide-stroke-soft-200 rounded-lg border border-stroke-soft-200 bg-bg-white-0 px-3">
        <SummaryRow
          label={formatMessage({ id: "app.send.review.to" })}
          value={recipientLabel}
          title={recipient.address}
          onEdit={onEditRecipient}
          editLabel={editLabel}
        />
        <SummaryRow
          label={formatMessage({ id: "app.send.review.token" })}
          value={token.symbol}
          onEdit={onEditAmount}
          editLabel={editLabel}
        />
        <SummaryRow
          label={formatMessage({ id: "app.send.review.amount" })}
          value={`${formatTokenAmount(parsedAmount, token.decimals)} ${token.symbol}`}
          onEdit={onEditAmount}
          editLabel={editLabel}
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

      {/* Offline is announced once, by the flow-level banner in SendTab (it is
          visible on every step, including this one), so no duplicate here. */}
    </div>
  );
}
