// DOCS-002: choosing a search result opens its page but left focus on the body, so the next Tab
// went to Skip to content. The local search plugin marks the pages it opens with `_highlight`
// (one per search term) and adds the heading's anchor when the result is a section, so a route
// reached from search moves focus to that heading, or to the page's title.
const SEARCH_PARAM = "_highlight";

export type SearchFocusTarget = {kind: "anchor"; id: string} | {kind: "title"} | null;

type RouteLocation = {pathname?: string; search: string; hash: string};

/**
 * Where focus goes after a route update, or null to leave it. Only arriving at a page from search
 * moves it: a later anchor link on the same page keeps the search terms in its URL but is the
 * reader's own move.
 */
export function searchFocusTarget(
  location: RouteLocation,
  previousLocation?: RouteLocation | null,
): SearchFocusTarget {
  if (!new URLSearchParams(location.search).has(SEARCH_PARAM)) return null;
  if (
    previousLocation &&
    previousLocation.pathname === location.pathname &&
    previousLocation.search === location.search
  ) {
    return null;
  }
  const anchor = location.hash.replace(/^#/, "");
  if (!anchor) return {kind: "title"};
  try {
    return {kind: "anchor", id: decodeURIComponent(anchor)};
  } catch {
    return {kind: "anchor", id: anchor};
  }
}
