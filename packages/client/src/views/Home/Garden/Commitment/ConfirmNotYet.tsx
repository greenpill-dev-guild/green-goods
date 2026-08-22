import { Alert, cn } from "@green-goods/shared";
import { RiRefreshLine, RiWifiOffLine } from "@remixicon/react";
import { useIntl } from "react-intl";

import { type ConfirmCast, REASON_CHIPS } from "./confirm-cast";

export interface ConfirmNotYetProps {
  cast: ConfirmCast;
  draftReason: string;
  setDraftReason: (reason: string) => void;
  isOnline: boolean;
  isPending: boolean;
  notYetFailed: boolean;
  onSend: () => void;
  onBack: () => void;
}

/**
 * The Not yet side of the confirmation sheet.
 *
 * A reason is required and the chips are only a head start on the words. It
 * raises a dispute and never cancels anything, and because that is an online
 * act it says so when the signal is gone rather than pretending to queue.
 */
export function ConfirmNotYet({
  cast,
  draftReason,
  setDraftReason,
  isOnline,
  isPending,
  notYetFailed,
  onSend,
  onBack,
}: ConfirmNotYetProps) {
  const { formatMessage } = useIntl();
  return (
    <div className="space-y-4" data-component="ConfirmSheetNotYet">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={formatMessage({ id: "app.confirm.notYet.chips" })}
      >
        {REASON_CHIPS[cast].map((chip) => {
          const label = formatMessage({ id: `app.confirm.notYet.chip.${chip}` });
          const selected = draftReason.trim() === label;
          return (
            <button
              key={chip}
              type="button"
              aria-pressed={selected}
              onClick={() => setDraftReason(label)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium tap-target-lg",
                selected
                  ? "border-primary-alpha-24 bg-primary-alpha-10 text-primary"
                  : "border-stroke-soft-200 text-text-sub-600"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div>
        <label className="block text-sm font-medium text-text-strong-950" htmlFor="confirm-not-yet">
          {formatMessage({ id: "app.confirm.notYet.label" })}
        </label>
        <textarea
          id="confirm-not-yet"
          value={draftReason}
          rows={3}
          maxLength={2000}
          placeholder={formatMessage({ id: `app.confirm.notYet.placeholder.${cast}` })}
          onChange={(event) => setDraftReason(event.target.value)}
          className="mt-1.5 w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
        />
      </div>
      {notYetFailed ? (
        <Alert variant="warning" className="p-3">
          {formatMessage({ id: "app.confirm.notYet.failed" })}
        </Alert>
      ) : !isOnline ? (
        <Alert variant="warning" className="p-3">
          <span className="flex items-start gap-2">
            <RiWifiOffLine className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {formatMessage({ id: "app.confirm.notYet.offline" })}
          </span>
        </Alert>
      ) : (
        <p className="text-xs text-text-soft-400">
          {formatMessage({ id: "app.confirm.notYet.neverCancels" })}
        </p>
      )}
      <button
        type="button"
        disabled={draftReason.trim().length === 0 || isPending || !isOnline}
        aria-busy={isPending}
        onClick={onSend}
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg disabled:opacity-60"
      >
        {notYetFailed ? <RiRefreshLine className="h-4 w-4" aria-hidden="true" /> : null}
        {formatMessage({
          id: notYetFailed ? "app.confirm.notYet.retry" : "app.confirm.notYet.send",
        })}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={onBack}
        className="w-full rounded-[var(--radius-lg)] px-4 py-3 text-sm font-medium text-text-sub-600 tap-target-lg"
      >
        {formatMessage({ id: "app.confirm.notYet.back" })}
      </button>
    </div>
  );
}
