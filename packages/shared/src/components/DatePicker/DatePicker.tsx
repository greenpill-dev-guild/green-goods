import * as Popover from "@radix-ui/react-popover";
import { RiCalendarLine, RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import { useState, useCallback, useMemo, forwardRef, type ReactNode } from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { cn } from "../../utils/styles/cn";

export interface DatePickerProps {
  /** Currently selected date as Unix timestamp (seconds) */
  value?: number | null;
  /** Called when a date is selected, receives Unix timestamp (seconds) or null */
  onChange?: (timestamp: number | null) => void;
  /** Placeholder text when no date is selected */
  placeholder?: string;
  /** Label for the input */
  label?: ReactNode;
  /** Helper text displayed below the input */
  helperText?: string;
  /** Error message to display */
  error?: string;
  /** Minimum selectable date as Unix timestamp (seconds) */
  minDate?: number | null;
  /** Maximum selectable date as Unix timestamp (seconds) */
  maxDate?: number | null;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** ID for the input element */
  id?: string;
  /** Additional class name for the trigger button */
  className?: string;
  /** Custom date formatter function */
  formatDate?: (date: Date) => string;
}

/**
 * Default date formatter - matches the format used in MetadataEditor
 */
function defaultFormatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Convert Unix timestamp (seconds) to Date object
 */
function timestampToDate(timestamp: number | null | undefined): Date | undefined {
  if (!timestamp || timestamp <= 0) return undefined;
  return new Date(timestamp * 1000);
}

/**
 * Convert Date object to Unix timestamp (seconds)
 */
function dateToTimestamp(date: Date | undefined): number | null {
  if (!date) return null;
  return Math.floor(date.getTime() / 1000);
}

/**
 * A date picker component using react-day-picker with Radix UI Popover.
 * Styled to match Green Goods design system.
 *
 * @example
 * <DatePicker
 *   label="Start Date"
 *   value={draft.workTimeframeStart}
 *   onChange={(timestamp) => onUpdate({ workTimeframeStart: timestamp ?? 0 })}
 *   placeholder="Select start date"
 *   required
 * />
 */
export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      placeholder = "Select date",
      label,
      helperText,
      error,
      minDate,
      maxDate,
      disabled = false,
      required = false,
      id,
      className,
      formatDate = defaultFormatDate,
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);

    const selectedDate = useMemo(() => timestampToDate(value), [value]);
    const minDateObj = useMemo(() => timestampToDate(minDate), [minDate]);
    const maxDateObj = useMemo(() => timestampToDate(maxDate), [maxDate]);

    const handleSelect = useCallback(
      (date: Date | undefined) => {
        onChange?.(dateToTimestamp(date));
        setOpen(false);
      },
      [onChange]
    );

    const displayValue = selectedDate ? formatDate(selectedDate) : null;

    // Determine which dates should be disabled
    const disabledDays: DayPickerProps["disabled"] = useMemo(() => {
      const disabled: DayPickerProps["disabled"] = [];
      if (minDateObj) {
        disabled.push({ before: minDateObj });
      }
      if (maxDateObj) {
        disabled.push({ after: maxDateObj });
      }
      return disabled.length > 0 ? disabled : undefined;
    }, [minDateObj, maxDateObj]);

    return (
      <div className={cn("flex flex-col gap-1", error && "shake-error")}>
        {label && (
          <label className="font-semibold text-text-strong-950 text-label-sm" htmlFor={id}>
            {label}
            {required && (
              <>
                <span className="ml-0.5 text-error-base" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">Required</span>
              </>
            )}
          </label>
        )}

        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              ref={ref}
              id={id}
              type="button"
              disabled={disabled}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-describedby={helperText || error ? `${id}-helper-text` : undefined}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg border bg-bg-white-0 px-3 py-2.5 text-left text-sm transition",
                "disabled:opacity-50 disabled:pointer-events-none",
                error
                  ? "border-error-base focus:ring-2 focus:ring-error-lighter focus:border-error-base"
                  : "border-stroke-sub-300 focus:ring-2 focus:ring-primary-lighter focus:border-primary-base",
                "focus:outline-none",
                className
              )}
            >
              <span className={cn(displayValue ? "text-text-strong-950" : "text-text-soft-400")}>
                {displayValue || placeholder}
              </span>
              <RiCalendarLine className="h-4 w-4 text-text-sub-600 flex-shrink-0" />
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={4}
              className={cn(
                "z-50 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-3 shadow-lg",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
              )}
            >
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleSelect}
                disabled={disabledDays}
                defaultMonth={selectedDate}
                showOutsideDays
                classNames={{
                  root: "w-fit",
                  months: "flex flex-col",
                  month: "space-y-3",
                  month_caption: "flex justify-center relative items-center h-9",
                  caption_label: "text-sm font-semibold text-text-strong-950",
                  nav: "flex items-center gap-1 absolute inset-x-0 justify-between",
                  button_previous: cn(
                    "h-7 w-7 flex items-center justify-center rounded-lg",
                    "text-text-sub-600 hover:bg-bg-soft-200 hover:text-text-strong-950",
                    "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  ),
                  button_next: cn(
                    "h-7 w-7 flex items-center justify-center rounded-lg",
                    "text-text-sub-600 hover:bg-bg-soft-200 hover:text-text-strong-950",
                    "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  ),
                  month_grid: "w-full border-collapse",
                  weekdays: "flex",
                  weekday:
                    "w-9 h-9 flex items-center justify-center text-xs font-medium text-text-sub-600",
                  week: "flex mt-1",
                  day: cn(
                    "w-9 h-9 flex items-center justify-center text-sm rounded-lg",
                    "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  ),
                  day_button: cn(
                    "w-full h-full flex items-center justify-center rounded-lg",
                    "hover:bg-bg-soft-200 transition cursor-pointer",
                    "focus:outline-none"
                  ),
                  selected: cn(
                    "bg-primary-base text-white-0 font-semibold",
                    "hover:bg-primary-dark"
                  ),
                  today: "font-bold text-primary-base",
                  outside: "text-text-disabled opacity-50",
                  disabled: "text-text-disabled opacity-30 cursor-not-allowed hover:bg-transparent",
                  hidden: "invisible",
                }}
                components={{
                  Chevron: ({ orientation }) =>
                    orientation === "left" ? (
                      <RiArrowLeftSLine className="h-4 w-4" />
                    ) : (
                      <RiArrowRightSLine className="h-4 w-4" />
                    ),
                }}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {(helperText || error) && (
          <p
            id={`${id}-helper-text`}
            className={cn("text-xs min-h-[1rem]", error ? "text-error-base" : "text-text-sub-600")}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";
