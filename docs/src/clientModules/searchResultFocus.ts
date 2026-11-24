import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";

import {type SearchFocusTarget, searchFocusTarget} from "./searchFocusTarget";

// Moves focus into a page opened from a search result (DOCS-002; the rule is `searchFocusTarget`).

function focusTarget(target: Exclude<SearchFocusTarget, null>): void {
  const element =
    (target.kind === "anchor" ? document.getElementById(target.id) : null) ??
    document.querySelector<HTMLElement>("main article h1, main h1") ??
    document.querySelector<HTMLElement>("main");
  if (!element) return;
  // Take focus without joining the tab order, and give the attribute back once focus leaves, so a
  // later click inside the element does not focus it.
  if (!element.hasAttribute("tabindex")) {
    element.setAttribute("tabindex", "-1");
    element.addEventListener("blur", () => element.removeAttribute("tabindex"), {once: true});
  }
  // The router has already placed the page; focusing must not move it again.
  element.focus({preventScroll: true});
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
