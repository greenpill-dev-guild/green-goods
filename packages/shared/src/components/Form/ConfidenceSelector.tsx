import { type KeyboardEvent, useCallback, useId, useMemo } from "react";
import { useIntl } from "react-intl";
import { Confidence } from "../../types/domain";
import { Chip } from "../Chip";

export interface ConfidenceSelectorProps {
  value: Confidence;
  onChange: (value: Confidence) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * A four-choice radio group for the verification confidence level, rendered as
 * shared `Chip`s with `role="radio"` (the same anatomy as AssetSelector), so it
 * takes the surface's capsule, label, and 44px hit area (DL-031).
 *
 * When `disabled` (e.g., for rejections), defaults to None and disables interaction.
 * When `required` (e.g., for approvals), None is not a choice: nothing is
 * selected until the reviewer picks Low or higher, the first chip holds the
 * tab stop meanwhile, and the hint appears only for a chosen level.
 */
export function ConfidenceSelector({
  value,
  onChange,
  disabled = false,
  required = false,
  className,
}: ConfidenceSelectorProps) {
  const { formatMessage } = useIntl();
  const groupId = useId();

  const CONFIDENCE_OPTIONS = useMemo(
    () =>
      [
        {
          value: Confidence.NONE,
          label: formatMessage({ id: "app.form.confidence.none", defaultMessage: "None" }),
          hint: formatMessage({
            id: "app.form.confidence.none.hint",
            defaultMessage: "No confidence in outcome",
          }),
        },
        {
          value: Confidence.LOW,
          label: formatMessage({ id: "app.form.confidence.low", defaultMessage: "Low" }),
          hint: formatMessage({
            id: "app.form.confidence.low.hint",
            defaultMessage: "Uncertain about accuracy",
          }),
        },
        {
          value: Confidence.MEDIUM,
          label: formatMessage({ id: "app.form.confidence.medium", defaultMessage: "Medium" }),
          hint: formatMessage({
            id: "app.form.confidence.medium.hint",
            defaultMessage: "Reasonably confident",
          }),
        },
        {
          value: Confidence.HIGH,
          label: formatMessage({ id: "app.form.confidence.high", defaultMessage: "High" }),
          hint: formatMessage({
            id: "app.form.confidence.high.hint",
            defaultMessage: "Very confident in outcome",
          }),
        },
      ].filter((option) => !required || option.value !== Confidence.NONE),
    [formatMessage, required]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      const selectedIndex = CONFIDENCE_OPTIONS.findIndex((o) => o.value === value);
      // With nothing chosen, focus sits on the first chip (the tab stop), so
      // the first arrow moves on from there instead of choosing it.
      const currentIndex = selectedIndex === -1 ? 0 : selectedIndex;
      let nextIndex = currentIndex;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = Math.min(currentIndex + 1, CONFIDENCE_OPTIONS.length - 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = Math.max(currentIndex - 1, 0);
      }

      if (nextIndex !== currentIndex) {
        onChange(CONFIDENCE_OPTIONS[nextIndex].value);
        // Focus the newly selected item
        const container = e.currentTarget;
        const buttons = container.querySelectorAll<HTMLButtonElement>("[role=radio]");
        buttons[nextIndex]?.focus();
      }
    },
    [value, onChange, disabled, CONFIDENCE_OPTIONS]
  );

  const selectedOption = CONFIDENCE_OPTIONS.find((o) => o.value === value);
  // With nothing chosen, the first chip takes the group's tab stop.
  const tabStopValue = selectedOption?.value ?? CONFIDENCE_OPTIONS[0]?.value;

  return (
    <div className={className}>
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving-tabindex radiogroup; focus lives on the <button role="radio"> children */}
      <div
        role="radiogroup"
        aria-label={formatMessage({
          id: "app.form.confidence.groupLabel",
          defaultMessage: "Confidence level",
        })}
        aria-required={required || undefined}
        onKeyDown={handleKeyDown}
        className="flex flex-wrap gap-2"
      >
        {CONFIDENCE_OPTIONS.map((option) => {
          const isSelected = option.value === value;
          return (
            <Chip
              key={option.value}
              id={`${groupId}-${option.value}`}
              role="radio"
              selected={isSelected}
              aria-checked={isSelected}
              aria-label={formatMessage(
                { id: "app.form.confidence.ariaLabel", defaultMessage: "{level} confidence" },
                { level: option.label }
              )}
              tabIndex={option.value === tabStopValue ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </Chip>
          );
        })}
      </div>
      {selectedOption && (
        <p className="mt-1.5 text-xs text-text-soft-400" aria-live="polite">
          {selectedOption.hint}
        </p>
      )}
    </div>
  );
}
