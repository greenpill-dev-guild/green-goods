import { cn } from "@green-goods/shared/utils/styles/cn";
import { useIntl } from "react-intl";

export interface CharacterCounterProps {
  /** The id the control's `aria-describedby` points at: the count in words. */
  id: string;
  /** Characters in the control, as its `maxLength` counts them. */
  count: number;
  /** The control's `maxLength`. */
  max: number;
  /** The field shows an error, so the counter turns the error color with it. */
  error?: boolean;
  disabled?: boolean;
}

/**
 * The M3 character counter: "324 / 420" at the end of a text field's
 * supporting row. The admin field family renders it when a field opts in with
 * `showCount` and its control has a `maxLength`; views never place it alone.
 *
 * - The visible numbers are hidden from assistive tech. The control's
 *   description reads the count in words instead, and a description is read
 *   when the control takes focus, not on every keystroke.
 * - A polite status says the limit is reached once, as it is reached. It
 *   clears when the text drops below the limit, so reaching it again says so
 *   again.
 * - A count past the limit only happens when older text, written before the
 *   limit, is loaded into the field. It turns the error color, because that
 *   text has to be shortened before it can be saved.
 */
export function CharacterCounter({
  id,
  count,
  max,
  error = false,
  disabled = false,
}: CharacterCounterProps) {
  const { formatMessage, formatNumber } = useIntl();
  return (
    <span
      data-component="CharacterCounter"
      className={cn(
        "ml-auto shrink-0 tabular-nums",
        error || count > max
          ? "text-[rgb(var(--m3-error))]"
          : "text-[rgb(var(--m3-on-surface-variant))]",
        disabled && "text-[rgb(var(--m3-on-surface)/0.38)]"
      )}
    >
      <span aria-hidden="true">{`${formatNumber(count)} / ${formatNumber(max)}`}</span>
      <span id={id} className="sr-only">
        {formatMessage(
          {
            id: "cockpit.textField.characterCount",
            defaultMessage: "{count, number} of {max, number} characters used",
          },
          { count, max }
        )}
      </span>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {count >= max
          ? formatMessage({
              id: "cockpit.textField.characterLimitReached",
              defaultMessage: "Character limit reached",
            })
          : null}
      </span>
    </span>
  );
}
