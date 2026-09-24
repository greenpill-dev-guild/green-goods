import { utf8ByteLength } from "@green-goods/shared/utils/app/text";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type IntlShape, useIntl } from "react-intl";

/** The text's length as the counter counts it: characters, or UTF-8 bytes. */
export const countedLength = (text: string, bytes: boolean) =>
  bytes ? utf8ByteLength(text) : text.length;

/**
 * What a field past its limit says: how to bring the text back under it. Past
 * a byte limit the count runs ahead of the characters, so it says why.
 */
export function overLimitMessage(
  formatMessage: IntlShape["formatMessage"],
  max: number,
  bytes: boolean
): string {
  return bytes
    ? formatMessage({
        id: "cockpit.textField.overByteLimit",
        defaultMessage: "Shorten this: accented letters count as two, and some symbols as more",
      })
    : formatMessage(
        {
          id: "cockpit.textField.overLimit",
          defaultMessage: "Shorten this to {max, number} characters or fewer",
        },
        { max }
      );
}

export interface CharacterCounterProps {
  /** The id the control's `aria-describedby` points at: the count in words. */
  id: string;
  /** Characters in the control, as its `maxLength` counts them, or UTF-8 bytes. */
  count: number;
  /** The control's `maxLength`. */
  max: number;
  /** The field shows an error, so the counter turns the error color with it. */
  error?: boolean;
  disabled?: boolean;
  /** The steward has edited the control. Until then the limit is not announced. */
  edited?: boolean;
  /** The count is UTF-8 bytes (`countBytes`), so its words say bytes, not characters. */
  bytes?: boolean;
}

/**
 * The M3 character counter: "324 / 420" at the end of a text field's
 * supporting row. The admin field family renders it when a field opts in with
 * `showCount` and its control has a `maxLength`; views never place it alone.
 *
 * - The visible numbers are hidden from assistive tech. The control's
 *   description reads the count in words instead, and a description is read
 *   when the control takes focus, not on every keystroke.
 * - A polite status says the limit is reached once, as an edit reaches it. It
 *   clears when the text leaves the limit, so reaching it again says so again.
 *   Text loaded at the limit stays quiet: nobody has typed yet.
 * - Past the limit, the count turns the error color and the field shows an
 *   error saying how to shorten it. Loaded text written before the limit can
 *   be there, and so can bytes, which a character `maxLength` cannot stop.
 */
export function CharacterCounter({
  id,
  count,
  max,
  error = false,
  disabled = false,
  edited = false,
  bytes = false,
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
        {bytes
          ? formatMessage(
              {
                id: "cockpit.textField.byteCount",
                defaultMessage: "{count, number} of {max, number} bytes used",
              },
              { count, max }
            )
          : formatMessage(
              {
                id: "cockpit.textField.characterCount",
                defaultMessage: "{count, number} of {max, number} characters used",
              },
              { count, max }
            )}
      </span>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {edited && count === max
          ? bytes
            ? formatMessage({
                id: "cockpit.textField.byteLimitReached",
                defaultMessage: "Byte limit reached",
              })
            : formatMessage({
                id: "cockpit.textField.characterLimitReached",
                defaultMessage: "Character limit reached",
              })
          : null}
      </span>
    </span>
  );
}
