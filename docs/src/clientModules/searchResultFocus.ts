import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";

import {type SearchFocusTarget, searchFocusTarget} from "./searchFocusTarget";

// Moves focus into a page opened from a search result (DOCS-002; the rule is `searchFocusTarget`).

function focusTarget(target: Exclude<SearchFocusTarget, null>): void {
  const element =
    (target.kind === "anchor" ? document.getElementById(target.id) : null) ??
    document.querySelector<HTMLElement>("main article h1, main h1") ??
    document.querySelector<HTMLElement>("main");
  if (!element) return;
  // Headings take focus without joining the tab order.
  if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "-1");
  // The router has already placed the page; focusing must not move it again.
  element.focus({preventScroll: true});
}

export function onRouteDidUpdate({
  location,
  previousLocation,
}: {
  location: {search: string; hash: string};
  previousLocation: unknown;
}): void {
  if (!ExecutionEnvironment.canUseDOM || !previousLocation) return;
  const target = searchFocusTarget(location);
  if (!target) return;
  // After the new page has painted, so its heading is in the document.
  window.requestAnimationFrame(() => focusTarget(target));
}
