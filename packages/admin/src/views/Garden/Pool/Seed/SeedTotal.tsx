import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiErrorWarningLine, RiStackLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";

export interface SeedTotalProps {
  /** How many separate promises the answer creates. */
  count: number;
  /** What each one asks for. */
  each: number;
  unit: string;
  busy: boolean;
  /** Turn the answer into promises of one each. */
  onMakeItOne: () => void;
}

/**
 * The arithmetic of a How Much answer, stated under it (PRD-1022 screens
 * 02–03): so many promises, each asking for so much. When both numbers are
 * above one it turns into a soft check, since "ten surveys" is more often ten
 * promises of one than ten of ten, and offers the fix. One height in both
 * states: the check changes its tone and words, never its size.
 */
export function SeedTotal({ count, each, unit, busy, onMakeItOne }: SeedTotalProps) {
  const { formatMessage } = useIntl();
  const warn = count > 1 && each > 1;
  return (
    <div
      role="status"
      data-testid="seed-total"
      data-warn={warn || undefined}
      className={cn(
        "grid min-h-[128px] grid-cols-[1.25rem_minmax(0,1fr)] content-center items-center gap-x-3 gap-y-1 rounded-[var(--m3-shape-md)] border px-4 py-3",
        "sm:min-h-[76px] sm:grid-cols-[1.25rem_minmax(0,1fr)_auto]",
        warn ? "border-warning-light bg-warning-lighter" : "border-bg-weak bg-bg-weak"
      )}
    >
      <span className={cn("grid", warn ? "text-warning-dark" : "text-text-sub")}>
        {warn ? (
          <RiErrorWarningLine className="h-5 w-5" aria-hidden />
        ) : (
          <RiStackLine className="h-5 w-5" aria-hidden />
        )}
      </span>
      <div className="min-w-0">
        <p className="body-sm font-semibold tabular-nums text-text-strong">
          {formatMessage(
            {
              id: "cockpit.garden.pool.seed.total",
              defaultMessage:
                "{count, plural, one {1 promise} other {# promises}} × {each} {unit} each = {total} {unit}",
            },
            { count, each, unit, total: count * each }
          )}
        </p>
        <p className={cn("body-xs", warn ? "text-warning-dark" : "text-text-sub")}>
          {warn
            ? formatMessage(
                {
                  id: "cockpit.garden.pool.seed.totalCheck",
                  defaultMessage:
                    "Did you mean {count} {unit} in total? Then each promise asks for 1.",
                },
                { count, unit }
              )
            : formatMessage({
                id: "cockpit.garden.pool.seed.totalHint",
                defaultMessage: "Each one is taken up, proven and confirmed on its own.",
              })}
        </p>
      </div>
      <span className="col-start-2 flex min-h-8 justify-start sm:col-start-3 sm:min-w-[8.25rem] sm:justify-end">
        {warn ? (
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            disabled={busy}
            onClick={onMakeItOne}
          >
            {formatMessage({
              id: "cockpit.garden.pool.seed.makeItOne",
              defaultMessage: "Make It 1 Each",
            })}
          </AdminButton>
        ) : null}
      </span>
    </div>
  );
}
