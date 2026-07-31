import { RiCheckLine } from "@remixicon/react";
import { type KeyboardEvent, type ReactNode, useCallback, useMemo, useRef } from "react";
import { cn } from "@green-goods/shared";

export interface AdminChoiceOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  leadingVisual?: ReactNode;
  trailingContent?: ReactNode;
  disabled?: boolean;
  lang?: string;
  title?: string;
}

export interface AdminChoiceGroupProps {
  ariaLabel: string;
  value: string | null | undefined;
  options: AdminChoiceOption[];
  onChange: (value: string) => void;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
  optionClassName?: string;
  descriptionClassName?: string;
}

const columnsClassName: Record<NonNullable<AdminChoiceGroupProps["columns"]>, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
};

/**
 * AdminChoiceGroup — compact single-select radio group.
 *
 * Use for simple one-of-N preferences or context switches inside dense admin
 * panels. Rich title + description + metadata choices should keep using
 * AdminSelectableCard; route/view modes should keep using AdminTabRail.
 */
export function AdminChoiceGroup({
  ariaLabel,
  value,
  options,
  onChange,
  columns = 1,
  className,
  optionClassName,
  descriptionClassName,
}: AdminChoiceGroupProps) {
  const refs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const enabledOptions = useMemo(() => options.filter((option) => !option.disabled), [options]);
  const hasSelectedOption = enabledOptions.some((option) => option.value === value);

  const moveSelection = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, direction: "next" | "previous" | "first" | "last") => {
      if (enabledOptions.length === 0) return;

      const activeValue = document.activeElement?.getAttribute("data-choice-value") ?? value;
      const currentIndex = Math.max(
        0,
        enabledOptions.findIndex((option) => option.value === activeValue)
      );
      const lastIndex = enabledOptions.length - 1;
      const nextIndex =
        direction === "first"
          ? 0
          : direction === "last"
            ? lastIndex
            : direction === "next"
              ? currentIndex >= lastIndex
                ? 0
                : currentIndex + 1
              : currentIndex <= 0
                ? lastIndex
                : currentIndex - 1;
      const nextOption = enabledOptions[nextIndex];
      if (!nextOption) return;

      event.preventDefault();
      onChange(nextOption.value);
      requestAnimationFrame(() => refs.current.get(nextOption.value)?.focus());
    },
    [enabledOptions, onChange, value]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        moveSelection(event, "next");
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        moveSelection(event, "previous");
        return;
      }
      if (event.key === "Home") {
        moveSelection(event, "first");
        return;
      }
      if (event.key === "End") {
        moveSelection(event, "last");
      }
    },
    [moveSelection]
  );

  return (
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving-tabindex radiogroup; focus lives on the <button role="radio"> options
    <div
      data-component="AdminChoiceGroup"
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn("grid gap-2", columnsClassName[columns], className)}
    >
      {options.map((option) => {
        const selected = value === option.value;
        const labelTitle =
          option.title ?? (typeof option.label === "string" ? option.label : undefined);

        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) refs.current.set(option.value, node);
              else refs.current.delete(option.value);
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={
              selected || (!hasSelectedOption && option.value === enabledOptions[0]?.value) ? 0 : -1
            }
            disabled={option.disabled}
            lang={option.lang}
            data-choice-value={option.value}
            data-selected={selected ? "true" : "false"}
            onClick={() => onChange(option.value)}
            className={cn(
              "group/choice relative flex min-h-11 w-full items-center gap-3 rounded-[var(--m3-shape-md)] border px-3 py-2 text-left",
              "transition-[background-color,border-color,color] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]",
              selected
                ? "border-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))] bg-[rgb(var(--m3-secondary-container))] text-[rgb(var(--m3-on-secondary-container))]"
                : "border-[rgb(var(--m3-outline))] bg-[rgb(var(--m3-surface))] text-[rgb(var(--m3-on-surface-variant))] hover:bg-[rgb(var(--m3-surface-container-low))]",
              option.disabled && "cursor-not-allowed opacity-[0.55]",
              optionClassName
            )}
          >
            {option.leadingVisual ? (
              <span
                className={cn(
                  "shrink-0 text-[rgb(var(--m3-on-surface-variant))]",
                  selected && "text-[rgb(var(--m3-on-secondary-container))]"
                )}
                aria-hidden="true"
              >
                {option.leadingVisual}
              </span>
            ) : null}

            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate text-sm font-semibold leading-5",
                  selected
                    ? "text-[rgb(var(--m3-on-secondary-container))]"
                    : "text-[rgb(var(--m3-on-surface))]"
                )}
                title={labelTitle}
              >
                {option.label}
              </span>
              {option.description ? (
                <span
                  className={cn(
                    "mt-0.5 block line-clamp-2 text-xs leading-5",
                    selected
                      ? "text-[rgb(var(--m3-on-secondary-container)/0.78)]"
                      : "text-[rgb(var(--m3-on-surface-variant))]",
                    descriptionClassName
                  )}
                >
                  {option.description}
                </span>
              ) : null}
            </span>

            {option.trailingContent ? (
              <span className="shrink-0">{option.trailingContent}</span>
            ) : selected ? (
              <RiCheckLine className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

AdminChoiceGroup.displayName = "AdminChoiceGroup";
