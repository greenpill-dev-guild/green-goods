/**
 * Typed route transitions for the installed PWA.
 *
 * `view-transitions.css` ships three directional types: `forwards`,
 * `backwards`, and `fade`. React Router's `viewTransition: true` flag wraps
 * navigations in `document.startViewTransition()` but does not let callsites
 * pass types. This helper bridges that gap by calling `startViewTransition`
 * directly with `types: [direction]`, falling back to a plain
 * `viewTransition: true` navigation on browsers without the API.
 *
 * Audit lane 04 B.1 documented the directional CSS but no callsite typed it.
 *
 * @module utils/app/route-transitions
 */

export type RouteTransitionDirection = "forwards" | "backwards" | "fade";

interface NavigateLike {
  (
    to: string | number,
    options?: { replace?: boolean; state?: unknown; viewTransition?: boolean }
  ): void;
}

interface DocumentWithViewTransition {
  startViewTransition?: (
    update: (() => void | Promise<void>) | { update: () => void | Promise<void>; types?: string[] }
  ) => unknown;
}

export interface NavigateWithTransitionOptions {
  /** One of the typed directions defined in `view-transitions.css`. */
  direction?: RouteTransitionDirection;
  replace?: boolean;
  state?: unknown;
}

/**
 * Detect support for View Transitions API _with types_.
 *
 * Older Chromium versions ship `startViewTransition` taking a callback only.
 * Passing the typed object form to those engines is treated as an opaque
 * truthy update callback and the types are silently ignored.
 */
function supportsTypedViewTransition(): boolean {
  if (typeof document === "undefined") return false;
  const doc = document as unknown as DocumentWithViewTransition;
  return typeof doc.startViewTransition === "function";
}

/**
 * Navigate with a typed view transition. The CSS in `view-transitions.css`
 * matches `html:active-view-transition-type(<direction>)` and provides the
 * directional slides / cross-fade for `main`. Reduced-motion is handled by
 * the existing scoped override at `view-transitions.css:177-183` plus the
 * global `*` rule, so callsites do not need to short-circuit themselves.
 */
export function navigateWithTransition(
  navigate: NavigateLike,
  to: string,
  options: NavigateWithTransitionOptions = {}
): void {
  const { direction, replace, state } = options;

  if (!direction || !supportsTypedViewTransition()) {
    navigate(to, { replace, state, viewTransition: true });
    return;
  }

  const doc = document as unknown as DocumentWithViewTransition;
  doc.startViewTransition?.({
    update: () => navigate(to, { replace, state }),
    types: [direction],
  });
}
