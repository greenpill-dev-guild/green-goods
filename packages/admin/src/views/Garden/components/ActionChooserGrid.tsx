import { type Action, Capital, cn } from "@green-goods/shared";
import { RiCheckLine, RiImageLine } from "@remixicon/react";
import { type KeyboardEvent, useRef, useState } from "react";
import { useIntl } from "react-intl";

/**
 * Capital → i18n label key. Reuses the action-authoring capital labels so the
 * chooser and the action editor stay in lockstep.
 */
const CAPITAL_LABEL_KEYS: Record<Capital, string> = {
  [Capital.SOCIAL]: "app.admin.actions.create.capitalSocial",
  [Capital.MATERIAL]: "app.admin.actions.create.capitalMaterial",
  [Capital.FINANCIAL]: "app.admin.actions.create.capitalFinancial",
  [Capital.LIVING]: "app.admin.actions.create.capitalLiving",
  [Capital.INTELLECTUAL]: "app.admin.actions.create.capitalIntellectual",
  [Capital.EXPERIENTIAL]: "app.admin.actions.create.capitalExperiential",
  [Capital.SPIRITUAL]: "app.admin.actions.create.capitalSpiritual",
  [Capital.CULTURAL]: "app.admin.actions.create.capitalCultural",
};

export interface ActionChooserGridProps {
  actions: Action[];
  /** Currently selected action id (`""` when nothing is chosen). */
  selectedActionId: string;
  onSelect: (actionId: string) => void;
  disabled?: boolean;
  /** Accessible name for the radiogroup (e.g. "Action"). */
  groupLabel: string;
}

// Warm Earth tag chip — matches the neutral chip used across admin views.
const chipClass =
  "inline-flex items-center gap-1 rounded-full bg-bg-soft px-2 py-0.5 text-[11px] font-medium text-text-sub";

/**
 * ActionChooserGrid — the Choose step of Submit Work.
 *
 * Replaces the raw `<select>` with a scannable grid of selectable action
 * cards. Visual treatment follows the admin selectable-card pattern used in the
 * sibling Create Assessment flow (DomainContextStep): soft-stroked white cards
 * that take a green-tinted selected state. Single-select via native radiogroup
 * semantics; one card per eligible action.
 */
export function ActionChooserGrid({
  actions,
  selectedActionId,
  onSelect,
  disabled = false,
  groupLabel,
}: ActionChooserGridProps) {
  const { formatMessage } = useIntl();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = actions.findIndex((action) => action.id === selectedActionId);
  const [focusedIndex, setFocusedIndex] = useState(() => (selectedIndex >= 0 ? selectedIndex : 0));
  // Roving-tabindex radiogroup: Arrow/Home/End move focus between cards;
  // Space/Enter (native button activation) selects. Selection-on-activation, not
  // selection-follows-focus, because selecting auto-advances out of the chooser.
  const activeIndex = focusedIndex < actions.length ? focusedIndex : 0;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || actions.length === 0) return;
    const last = actions.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        next = activeIndex >= last ? 0 : activeIndex + 1;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        next = activeIndex <= 0 ? last : activeIndex - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    setFocusedIndex(next);
    buttonRefs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      onKeyDown={handleKeyDown}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {actions.map((action, index) => {
        const selected = action.id === selectedActionId;
        const required = action.mediaInfo?.required ?? false;
        const minImages = required ? (action.mediaInfo?.minImageCount ?? 1) : 0;

        return (
          <button
            key={action.id}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === activeIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onSelect(action.id)}
            onFocus={() => setFocusedIndex(index)}
            data-component="ActionChooserCard"
            data-selected={selected}
            className={cn(
              "relative flex h-full w-full flex-col gap-1.5 rounded-lg border px-4 py-3.5 text-left",
              "transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
              selected
                ? "border-primary-base bg-primary-alpha-10"
                : "border-stroke-soft bg-bg-white hover:border-primary-alpha-24 hover:bg-primary-alpha-10",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            {selected ? (
              <RiCheckLine
                className="absolute right-3 top-3 h-4 w-4 text-primary-base"
                aria-hidden="true"
              />
            ) : null}

            <span
              className={cn(
                "pr-6 text-sm font-semibold",
                selected ? "text-primary-darker" : "text-text-strong"
              )}
            >
              {action.title}
            </span>

            {action.description ? (
              <span className="line-clamp-2 text-xs text-text-soft">{action.description}</span>
            ) : null}

            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              {action.capitals.map((capital) => {
                const labelKey = CAPITAL_LABEL_KEYS[capital];
                if (!labelKey) return null;
                return (
                  <span key={capital} className={chipClass}>
                    {formatMessage({ id: labelKey })}
                  </span>
                );
              })}
              <span className={chipClass}>
                <RiImageLine className="h-3 w-3" aria-hidden="true" />
                {required
                  ? formatMessage(
                      { id: "app.admin.work.submit.photosRequired" },
                      { count: minImages }
                    )
                  : formatMessage({ id: "app.admin.work.submit.photosOptional" })}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

ActionChooserGrid.displayName = "ActionChooserGrid";
