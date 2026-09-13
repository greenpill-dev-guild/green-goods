import { Alert } from "@green-goods/shared/components/Alert";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiWifiOffLine } from "@remixicon/react";
import { useIntl } from "react-intl";

import { type ConfirmCast, REASON_CHIPS } from "./confirmCast";

export interface ConfirmNotYetProps {
  cast: ConfirmCast;
  draftReason: string;
  setDraftReason: (reason: string) => void;
  isOnline: boolean;
  notYetFailed: boolean;
}

/**
 * The Not yet side of the confirmation sheet.
 *
 * A reason is required and the chips are only a head start on the words. It
 * raises a dispute and never cancels anything, and because that is an online
 * act it says so when the signal is gone rather than pretending to queue.
 * Its Send and Back actions live in the confirmation sheet's action bar.
 */
export function ConfirmNotYet({
  cast,
  draftReason,
  setDraftReason,
  isOnline,
  notYetFailed,
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
          className="gg-control gg-control-textarea mt-1.5"
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
    </div>
  );
}
