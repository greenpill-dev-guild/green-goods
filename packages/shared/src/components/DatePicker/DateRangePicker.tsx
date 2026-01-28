import * as Popover from "@radix-ui/react-popover";
import {
  RiCalendarLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiArrowRightLine,
} from "@remixicon/react";
import { useState, useCallback, useMemo, forwardRef } from "react";
import { DayPicker, type DateRange, type DayPickerProps } from "react-day-picker";
import { cn } from "../../utils/styles/cn";

export interface DateRangePickerProps {
  /** Start date as Unix timestamp (seconds) */
  startValue?: number | null;
  /** End date as Unix timestamp (seconds) */
  endValue?: number | null;
  /** Called when start date changes */
  onStartChange?: (timestamp: number | null) => void;
  /** Called when end date changes */
  onEndChange?: (timestamp: number | null) => void;
  /** Called when both dates change at once */
  onRangeChange?: (start: number | null, end: number | null) => void;
  /** Placeholder for start date */
  startPlaceholder?: string;
  /** Placeholder for end date */
  endPlaceholder?: string;
  /** Label for the field group */
  label?: string;
  /** Helper text displayed below the inputs */
  helperText?: string;
  /** Error message to display */
  error?: string;
  /** Minimum selectable date as Unix timestamp (seconds) */
  minDate?: number | null;
  /** Maximum selectable date as Unix timestamp (seconds) */
  maxDate?: number | null;
  /** Whether the inputs are disabled */
  disabled?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** ID prefix for the input elements */
  id?: string;
  /** Additional class name for the container */
  className?: string;
  /** Custom date formatter function */
  formatDate?: (date: Date) => string;
  /** Number of months to display in the calendar */
  numberOfMonths?: 1 | 2;
}

/**
 * Default date formatter
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
 * A date range picker component for selecting start and end dates.
 * Uses react-day-picker with Radix UI Popover.
 * Styled to match Green Goods design system.
 *
 * @example
 * <DateRangePicker
 *   label="Work Timeframe"
 *   startValue={draft.workTimeframeStart}
 *   endValue={draft.workTimeframeEnd}
 *   onRangeChange={(start, end) => onUpdate({
 *     workTimeframeStart: start ?? 0,
 *     workTimeframeEnd: end ?? 0,
 *   })}
 *   required
 * />
 */
export const DateRangePicker = forwardRef<HTMLDivElement, DateRangePickerProps>(
  (
    {
      startValue,
      endValue,
      onStartChange,
      onEndChange,
      onRangeChange,
      startPlaceholder = "Start date",
      endPlaceholder = "End date",
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
      numberOfMonths = 2,
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);

    const startDate = useMemo(() => timestampToDate(startValue), [startValue]);
    const endDate = useMemo(() => timestampToDate(endValue), [endValue]);
    const minDateObj = useMemo(() => timestampToDate(minDate), [minDate]);
    const maxDateObj = useMemo(() => timestampToDate(maxDate), [maxDate]);

    const selectedRange: DateRange | undefined = useMemo(() => {
      if (!startDate && !endDate) return undefined;
      return { from: startDate, to: endDate };
    }, [startDate, endDate]);

    const handleSelect = useCallback(
      (range: DateRange | undefined) => {
        const newStart = dateToTimestamp(range?.from);
        const newEnd = dateToTimestamp(range?.to);

        if (onRangeChange) {
          onRangeChange(newStart, newEnd);
        } else {
          onStartChange?.(newStart);
          onEndChange?.(newEnd);
        }

        // Close popover only when both dates are selected
        if (range?.from && range?.to) {
          setOpen(false);
        }
      },
      [onRangeChange, onStartChange, onEndChange]
    );

    const displayStart = startDate ? formatDate(startDate) : null;
    const displayEnd = endDate ? formatDate(endDate) : null;

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
      <div ref={ref} className={cn("flex flex-col gap-1", error && "shake-error", className)}>
        {label && (
          <label className="font-semibold text-text-strong-950 text-label-sm">
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
              id={id}
              type="button"
              disabled={disabled}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-describedby={helperText || error ? `${id}-helper-text` : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border bg-bg-white-0 px-3 py-2.5 text-left text-sm transition",
                "disabled:opacity-50 disabled:pointer-events-none",
                error
                  ? "border-error-base focus:ring-2 focus:ring-error-lighter focus:border-error-base"
                  : "border-stroke-sub-300 focus:ring-2 focus:ring-primary-lighter focus:border-primary-base",
                "focus:outline-none"
              )}
            >
              <RiCalendarLine className="h-4 w-4 text-text-sub-600 flex-shrink-0" />
              <span
                className={cn(
                  "flex-1",
                  displayStart ? "text-text-strong-950" : "text-text-soft-400"
                )}
              >
                {displayStart || startPlaceholder}
              </span>
              <RiArrowRightLine className="h-4 w-4 text-text-sub-600 flex-shrink-0" />
              <span
                className={cn("flex-1", displayEnd ? "text-text-strong-950" : "text-text-soft-400")}
              >
                {displayEnd || endPlaceholder}
              </span>
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
                mode="range"
                selected={selectedRange}
                onSelect={handleSelect}
                disabled={disabledDays}
                defaultMonth={startDate}
                numberOfMonths={numberOfMonths}
                showOutsideDays
                classNames={{
                  root: "w-fit",
                  months: "flex gap-4",
                  month: "space-y-3",
                  month_caption: "flex justify-center relative items-center h-9",
                  caption_label: "text-sm font-semibold text-text-strong-950",
                  nav: "flex items-center gap-1",
                  button_previous: cn(
                    "absolute left-0 h-7 w-7 flex items-center justify-center rounded-lg",
                    "text-text-sub-600 hover:bg-bg-soft-200 hover:text-text-strong-950",
                    "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  ),
                  button_next: cn(
                    "absolute right-0 h-7 w-7 flex items-center justify-center rounded-lg",
                    "text-text-sub-600 hover:bg-bg-soft-200 hover:text-text-strong-950",
                    "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  ),
                  month_grid: "w-full border-collapse",
                  weekdays: "flex",
                  weekday:
                    "w-9 h-9 flex items-center justify-center text-xs font-medium text-text-sub-600",
                  week: "flex mt-1",
                  day: cn(
                    "w-9 h-9 flex items-center justify-center text-sm",
                    "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  ),
                  day_button: cn(
                    "w-full h-full flex items-center justify-center rounded-lg",
                    "hover:bg-bg-soft-200 transition cursor-pointer",
                    "focus:outline-none"
                  ),
                  selected: "bg-primary-base text-white-0 font-semibold hover:bg-primary-dark",
                  range_start: "rounded-l-lg rounded-r-none bg-primary-base text-white-0",
                  range_end: "rounded-r-lg rounded-l-none bg-primary-base text-white-0",
                  range_middle: "rounded-none bg-primary-lighter text-primary-dark",
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

DateRangePicker.displayName = "DateRangePicker";
