import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";

import {type SearchFocusTarget, searchFocusTarget} from "./searchFocusTarget";

// Moves focus into a page opened from a search result (DOCS-002; the rule is `searchFocusTarget`).

function focusTarget(target: Exclude<SearchFocusTarget, null>): void {
  const element =
    (target.kind === "anchor" ? document.getElementById(target.id) : null) ??
    document.querySelector<HTMLElement>("main article h1, main h1") ??
    document.querySelector<HTMLElement>("main");
  if (!element) return;
  // As Docusaurus focuses programmatically: take focus without joining the tab order, then let
  // the element go back to how it was, so a later click inside it does not focus it.
  const hadTabIndex = element.hasAttribute("tabindex");
  if (!hadTabIndex) element.setAttribute("tabindex", "-1");
  // The router has already placed the page; focusing must not move it again.
  element.focus({preventScroll: true});
  if (!hadTabIndex) element.removeAttribute("tabindex");
}

export function onRouteDidUpdate({
  location,
  previousLocation,
}: {
  location: {pathname: string; search: string; hash: string};
  previousLocation: {pathname: string; search: string; hash: string} | null;
}): void {
  if (!ExecutionEnvironment.canUseDOM || !previousLocation) return;
  const target = searchFocusTarget(location, previousLocation);
  if (!target) return;
  // After the new page has painted, so its heading is in the document.
  window.requestAnimationFrame(() => focusTarget(target));
}
