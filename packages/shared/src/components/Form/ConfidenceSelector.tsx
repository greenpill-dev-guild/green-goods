import { useCallback, useId, type KeyboardEvent } from "react";
import { Confidence } from "../../types/domain";
import { cn } from "../../utils/styles/cn";

const CONFIDENCE_OPTIONS = [
  { value: Confidence.NONE, label: "None", hint: "No confidence in outcome" },
  { value: Confidence.LOW, label: "Low", hint: "Uncertain about accuracy" },
  { value: Confidence.MEDIUM, label: "Medium", hint: "Reasonably confident" },
  { value: Confidence.HIGH, label: "High", hint: "Very confident in outcome" },
] as const;

export interface ConfidenceSelectorProps {
  value: Confidence;
  onChange: (value: Confidence) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * A 4-segment radio group for selecting verification confidence level.
 *
 * When `disabled` (e.g., for rejections), defaults to None and disables interaction.
 * When `required` (e.g., for approvals), the user must select Low or higher.
 */
export function ConfidenceSelector({
  value,
  onChange,
  disabled = false,
  required = false,
  className,
}: ConfidenceSelectorProps) {
  const groupId = useId();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      const currentIndex = CONFIDENCE_OPTIONS.findIndex((o) => o.value === value);
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
    [value, onChange, disabled]
  );

  const selectedOption = CONFIDENCE_OPTIONS.find((o) => o.value === value);

  return (
    <div className={className}>
      <div
        role="radiogroup"
        aria-label="Confidence level"
        aria-required={required || undefined}
        onKeyDown={handleKeyDown}
        className="flex gap-1"
      >
        {CONFIDENCE_OPTIONS.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              id={`${groupId}-${option.value}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${option.label} confidence`}
              tabIndex={isSelected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-1",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                isSelected
                  ? "bg-primary-base text-white"
                  : "bg-bg-weak-50 text-text-sub-600 hover:bg-bg-soft-200"
              )}
            >
              {option.label}
            </button>
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
