import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 * Updates reactively when the match state changes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * Keeps focus on a surface whose controls a media query swaps, such as a dialog
 * that renders a different Close button in its phone and centered layouts.
 *
 * When `matches` flips and the focused control left with the old layout, focus
 * has fallen to the body, or to the surface itself, where a focus trap such as
 * Radix's puts it. It then moves to the first element in the surface that
 * `selector` names. Focus that survived the flip, in a field say, stays put, and
 * nothing happens on mount, so a dialog's own opening focus is left alone.
 */
export function useFocusAfterFlip(
  matches: boolean,
  surfaceRef: RefObject<HTMLElement | null>,
  selector: string
): void {
  const previous = useRef(matches);

  useEffect(() => {
    if (previous.current === matches) return;
    previous.current = matches;
    const surface = surfaceRef.current;
    if (!surface) return;
    const focused = surface.ownerDocument.activeElement;
    const lost =
      !focused ||
      !focused.isConnected ||
      focused === surface ||
      focused === surface.ownerDocument.body;
    if (lost) surface.querySelector<HTMLElement>(selector)?.focus();
  }, [matches, surfaceRef, selector]);
}
