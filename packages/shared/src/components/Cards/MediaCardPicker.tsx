/**
 * MediaCardPicker — choosing one object from media cards, the same on the installed app
 * and the cockpit: the action a work answers, or the garden it is for.
 *
 * The cards are the options of one listbox with one tab stop: Tab reaches the chosen card (or,
 * with nothing chosen, the first), the arrow keys and Home and End move between cards, and Space,
 * Enter or a press chooses one. Moving never chooses, because choosing an action resets the
 * work's details; a listbox lets the choice stay apart from focus, where radios would check as
 * focus moves. The chosen card takes the media card's selected mark, the 3px border in the focus
 * role. `row` lays the cards in one row that scrolls sideways, each 90% of it, snapping
 * to a card's start (the installed app); `grid` lays them one to a row, then two once the
 * picker is 36rem wide (the cockpit's flow dialog); `tiles` lays them two to a row at every
 * width, each picture in a 16:9 frame and each title on two lines, so every tile is one height
 * (the installed app's Start step, DL-131). While the options load, `loading` holds their place
 * with four empty cards in the same layout (DL-056).
 *
 * @module components/Cards/MediaCardPicker
 */
import * as React from "react";
import { cn } from "../../utils/styles/cn";
import { MediaCard, type MediaCardProps, MediaCardSkeleton } from "./MediaCard";

export type MediaCardPickerLayout = "row" | "grid" | "tiles";

export interface MediaCardPickerOption
  extends Pick<
    MediaCardProps,
    | "media"
    | "mediaLabel"
    | "mediaCount"
    | "title"
    | "status"
    | "subtitle"
    | "details"
    | "detailsEnd"
    | "detailsTitle"
  > {
  value: string;
  disabled?: boolean;
}

export interface MediaCardPickerProps {
  options: readonly MediaCardPickerOption[];
  /** The chosen option's value; nothing is chosen when it matches no option. */
  value: string | null;
  onChange: (value: string) => void;
  /** Names the group for assistive technology. */
  label: string;
  layout: MediaCardPickerLayout;
  /** Turns every card off while choosing cannot happen. */
  disabled?: boolean;
  /** Holds the options' place while they load. */
  loading?: boolean;
  className?: string;
}

const SKELETON_COUNT = 4;

const GRID_CLASS = "grid grid-cols-1 gap-(--gg-list-gap) @min-[36rem]:grid-cols-2";

const LAYOUT_CLASSES: Record<MediaCardPickerLayout, { group: string; card: string }> = {
  row: {
    group: "flex snap-x snap-mandatory gap-(--gg-list-gap) overflow-x-auto pb-1",
    card: "w-[90%] shrink-0 snap-start",
  },
  grid: {
    group: "@container",
    card: "",
  },
  tiles: {
    group: "grid grid-cols-2 gap-(--gg-list-gap)",
    card: "",
  },
};

/** Two-up tiles share a row, so each keeps its picture in proportion and a two-line title. */
const TILE_CARD = { mediaShape: "photo", titleLines: 2 } as const;
const BANNER_CARD = { mediaShape: "banner", titleLines: 1 } as const;

/** The next card that can take focus from `from`, stepping by `step` and wrapping. */
function nextEnabled(
  options: readonly MediaCardPickerOption[],
  from: number,
  step: 1 | -1
): number {
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index = (from + step * offset + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return from;
}

export function MediaCardPicker({
  options,
  value,
  onChange,
  label,
  layout,
  disabled = false,
  loading = false,
  className,
}: MediaCardPickerProps) {
  const cardRefs = React.useRef<(HTMLElement | null)[]>([]);
  const chosenIndex = options.findIndex((option) => option.value === value);
  const firstEnabled = options.findIndex((option) => !option.disabled);
  // The card that holds the tab stop while focus moves inside the group; outside it, the
  // tab stop returns to the chosen card.
  const [focusedIndex, setFocusedIndex] = React.useState<number | null>(null);
  const restingIndex = chosenIndex >= 0 ? chosenIndex : Math.max(firstEnabled, 0);
  const tabStop =
    focusedIndex !== null && focusedIndex < options.length ? focusedIndex : restingIndex;

  const moveFocus = (index: number) => {
    setFocusedIndex(index);
    cardRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || options.length === 0) return;
    const from = focusedIndex ?? tabStop;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        moveFocus(nextEnabled(options, from, 1));
        break;
      case "ArrowLeft":
      case "ArrowUp":
        moveFocus(nextEnabled(options, from, -1));
        break;
      case "Home":
        moveFocus(nextEnabled(options, -1, 1));
        break;
      case "End":
        moveFocus(nextEnabled(options, options.length, -1));
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedIndex(null);
  };

  if (loading) {
    const skeletons = Array.from({ length: SKELETON_COUNT }, (_, index) => (
      <MediaCardSkeleton
        key={`skeleton-${index}`}
        {...(layout === "tiles" ? TILE_CARD : BANNER_CARD)}
        className={LAYOUT_CLASSES[layout].card}
      />
    ));
    return (
      <div aria-busy="true" className={cn(LAYOUT_CLASSES[layout].group, className)}>
        {layout === "grid" ? <div className={GRID_CLASS}>{skeletons}</div> : skeletons}
      </div>
    );
  }

  const cards = options.map((option, index) => {
    const { value: optionValue, disabled: optionDisabled, ...card } = option;
    const chosen = index === chosenIndex;
    return (
      <MediaCard
        key={optionValue}
        {...card}
        ref={(element: HTMLElement | null) => {
          cardRefs.current[index] = element;
        }}
        {...(layout === "tiles" ? TILE_CARD : BANNER_CARD)}
        role="option"
        aria-selected={chosen}
        tabIndex={index === tabStop ? 0 : -1}
        selected={chosen}
        disabled={disabled || optionDisabled}
        onFocus={() => setFocusedIndex(index)}
        onClick={() => {
          setFocusedIndex(index);
          onChange(optionValue);
        }}
        className={LAYOUT_CLASSES[layout].card}
      />
    );
  });

  return (
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving-tabindex listbox; focus lives on the chosen card
    <div
      role="listbox"
      aria-label={label}
      aria-orientation={layout === "row" ? "horizontal" : "vertical"}
      aria-disabled={disabled || undefined}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={cn(LAYOUT_CLASSES[layout].group, className)}
    >
      {layout === "grid" ? (
        <div role="presentation" className={GRID_CLASS}>
          {cards}
        </div>
      ) : (
        cards
      )}
    </div>
  );
}
