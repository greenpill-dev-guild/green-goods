import React from "react";
import { cn } from "@/utils/cn";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  className,
  id,
  ...ariaProps
}) => {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked);

  const isChecked = checked !== undefined ? checked : internalChecked;

  const handleToggle = () => {
    if (disabled) return;

    const newChecked = !isChecked;
    if (checked === undefined) {
      setInternalChecked(newChecked);
    }
    onCheckedChange?.(newChecked);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      disabled={disabled}
      id={id}
      onClick={handleToggle}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        isChecked ? "bg-primary" : "bg-slate-200",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...ariaProps}
    >
      <span
        className={cn(
          "inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm",
          isChecked ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  );
};
