import { useCallback, type KeyboardEvent } from "react";
import { VerificationMethod } from "../../types/domain";
import { cn } from "../../utils/styles/cn";

const METHOD_OPTIONS = [
  { value: VerificationMethod.HUMAN, label: "Human", icon: "ri-user-line" },
  { value: VerificationMethod.IOT, label: "IoT", icon: "ri-sensor-line" },
  { value: VerificationMethod.ONCHAIN, label: "Onchain", icon: "ri-links-line" },
  { value: VerificationMethod.AGENT, label: "Agent", icon: "ri-robot-2-line" },
] as const;

export interface MethodSelectorProps {
  /** Bitmask value combining VerificationMethod flags */
  value: number;
  /** Called with updated bitmask when selection changes */
  onChange: (bitmask: number) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * A multi-select toggle group for verification methods.
 *
 * Uses bitmask values: HUMAN=1, IOT=2, ONCHAIN=4, AGENT=8.
 * Multiple methods can be selected simultaneously.
 */
export function MethodSelector({
  value,
  onChange,
  disabled = false,
  className,
}: MethodSelectorProps) {
  const toggle = useCallback(
    (method: number) => {
      if (disabled) return;
      const isActive = (value & method) !== 0;
      onChange(isActive ? value & ~method : value | method);
    },
    [value, onChange, disabled]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, method: number) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle(method);
      }
    },
    [toggle]
  );

  return (
    <div
      role="group"
      aria-label="Verification methods"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {METHOD_OPTIONS.map((option) => {
        const isActive = (value & option.value) !== 0;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            aria-label={`${option.label} verification`}
            disabled={disabled}
            onClick={() => toggle(option.value)}
            onKeyDown={(e) => handleKeyDown(e, option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-1",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isActive
                ? "bg-primary-base text-white"
                : "bg-bg-weak-50 text-text-sub-600 hover:bg-bg-soft-200 border border-stroke-sub-300"
            )}
          >
            <i className={cn(option.icon, "text-base")} aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
